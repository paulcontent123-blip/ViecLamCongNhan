import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as inquiries from '../src/lib/worker-inquiries.ts';
import { parseEmployerListParams } from '../src/lib/mobile-employer-list-params.ts';

const localRequire = createRequire(import.meta.url);
const plain = value => JSON.parse(JSON.stringify(value));
const ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const row = { kind: 'insurance_inquiry', id: ID, full_name: 'Công nhân thử', phone: '0901234567', email: null, message: 'Cần tư vấn', subject: 'Bảo hiểm tai nạn', provider_name: 'Đơn vị A', extra: null, partner_status: 'new', routed_to: 'admin', admin_status: 'new', admin_note: null, forwarded_at: null, created_at: '2026-11-02T00:00:00Z', updated_at: '2026-11-02T00:00:00Z' };

// Nạp một tệp TypeScript của dự án vào vm với các mô-đun giả lập.
function load(path, dependencies) {
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: key => dependencies[key] ?? localRequire(key), Error, RangeError, Response, Buffer, Date });
  return exports;
}

// ── Bộ lọc, schema và câu truy vấn ──
test('worker inquiry filters default to the admin queue and reject bad input', () => {
  const filters = inquiries.parseWorkerInquiryFilters(new URLSearchParams(''));
  assert.deepEqual(plain(filters), { kind: '', routed: 'admin', status: '', id: '', q: '' });
  assert.equal(inquiries.parseWorkerInquiryFilters(new URLSearchParams('kind=finance_inquiry&routed=all&status=closed')).routed, 'all');
  for (const query of ['kind=rental_inquiry', 'kind=health_inquiry', 'routed=other', 'status=resolved', 'id=khong-phai-uuid', `q=${'a'.repeat(101)}`, 'q=%25%25']) {
    assert.throws(() => inquiries.parseWorkerInquiryFilters(new URLSearchParams(query)), RangeError, query);
  }
  assert.equal(/[(),%_*"\\]/.test(inquiries.parseWorkerInquiryFilters(new URLSearchParams('q=a%2Cb%28c%29')).q), false);
});

test('worker inquiry patch accepts only status, note and forward', () => {
  const schema = inquiries.workerInquiryPatchSchema;
  for (const body of [{ adminStatus: 'closed' }, { adminNote: null }, { adminNote: '  đã gọi  ' }, { forward: true }, { adminStatus: 'contacted', adminNote: 'x', forward: true }]) assert.equal(schema.safeParse(body).success, true, JSON.stringify(body));
  assert.equal(schema.parse({ adminNote: '  đã gọi  ' }).adminNote, 'đã gọi');
  for (const body of [{}, { forward: false }, { adminStatus: 'resolved' }, { routedTo: 'provider' }, { adminNote: 'a'.repeat(1001) }, null, 'x']) assert.equal(schema.safeParse(body).success, false, JSON.stringify(body));
});

test('worker inquiry list query filters by queue, status and search, then paginates', () => {
  const calls = [];
  const query = {};
  for (const method of ['select', 'order', 'eq', 'or']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  query.range = (...args) => { calls.push(['range', ...args]); return query; };
  const client = { from: table => { calls.push(['from', table]); return query; } };
  inquiries.workerInquiryListQuery(client, inquiries.parseWorkerInquiryFilters(new URLSearchParams('kind=finance_inquiry&status=new&q=bao+hiem')), 20, 20);
  assert.deepEqual(calls[0], ['from', 'admin_worker_inquiries']);
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'routed_to' && c[2] === 'admin'));
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'kind' && c[2] === 'finance_inquiry'));
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'admin_status' && c[2] === 'new'));
  assert.ok(calls.some(c => c[0] === 'or' && ['full_name', 'phone', 'subject', 'provider_name'].every(column => c[1].includes(column + '.ilike.%bao hiem%'))));
  assert.deepEqual(calls.at(-1), ['range', 20, 39]);
  calls.length = 0;
  inquiries.workerInquiryListQuery(client, inquiries.parseWorkerInquiryFilters(new URLSearchParams('routed=all')), 0, 20);
  assert.equal(calls.some(c => c[0] === 'eq' && c[1] === 'routed_to'), false);
});

// ── Route danh sách và route cập nhật ──
function route(kind, { allowed = true, unauthenticated = false, listResult = { data: [row], count: 1, error: null }, pendingCount = 3, update = { ok: true, item: row, forwarded: false } } = {}) {
  const log = [];
  const calls = [];
  const builder = () => {
    const query = {};
    for (const method of ['select', 'order', 'eq', 'or']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
    query.range = async (...args) => { calls.push(['range', ...args]); return listResult; };
    query.then = resolve => resolve({ count: pendingCount, error: null });
    return query;
  };
  const dependencies = {
    'next/server': { NextResponse: { json: (body, init = {}) => new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } }) } },
    '@/lib/admin-auth': { requireAdmin: async capability => {
      log.push(['requireAdmin', capability]);
      return allowed ? { session: { userId: ADMIN_ID, adminRole: 'editor' } } : { error: new Response('{}', { status: unauthenticated ? 401 : 403 }) };
    } },
    '@/lib/admin-audit': { logAdminAction: async (...args) => { log.push(['audit', ...args]); } },
    '@/lib/admin-worker-inquiries': { updateWorkerInquiry: async (...args) => { log.push(['update', ...args]); return update; } },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => { log.push(['db']); return { from: table => { calls.push(['from', table]); return builder(); } }; } },
    '@/lib/supabase/safe-error-log': { logSafeSupabaseError: () => 'safe-request-id' },
    '@/lib/mobile-employer-list-params': { parseEmployerListParams },
    '@/lib/worker-inquiries': inquiries,
  };
  const exports = load(`../src/app/api/mobile/admin/worker-inquiries/${kind === 'list' ? '' : '[kind]/[id]/'}route.ts`, dependencies);
  return {
    log, calls,
    get: (queryString = '') => exports.GET({ nextUrl: new URL(`https://example.com/api/mobile/admin/worker-inquiries?${queryString}`) }),
    patch: (body, { kind: k = 'insurance_inquiry', id = ID } = {}) => exports.PATCH({ json: async () => { if (body === undefined) throw new Error('no body'); return body; } }, { params: Promise.resolve({ kind: k, id }) }),
  };
}

test('list route allows any admin level, rejects anonymous before reading and sanitizes failures', async () => {
  for (const unauthenticated of [false, true]) {
    const api = route('list', { allowed: false, unauthenticated });
    const response = await api.get();
    assert.equal(response.status, unauthenticated ? 401 : 403);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(api.log.some(entry => entry[0] === 'db'), false);
  }
  const api = route('list');
  const response = await api.get('page=2&pageSize=20&kind=insurance_inquiry');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, 1); assert.equal(body.newCount, 3); assert.equal(body.page, 2);
  assert.deepEqual(api.log.find(entry => entry[0] === 'requireAdmin'), ['requireAdmin', undefined]);
  for (const query of ['page=0', 'kind=health_inquiry', 'routed=x', 'status=resolved']) {
    const bad = route('list'); assert.equal((await bad.get(query)).status, 400, query);
    assert.equal(bad.log.some(entry => entry[0] === 'db'), false);
  }
  const failing = route('list', { listResult: { data: null, count: null, error: { code: '08006', message: 'private diagnostics' } } });
  const failed = await failing.get();
  assert.equal(failed.status, 503);
  const text = JSON.stringify(await failed.json());
  assert.equal(text.includes('private diagnostics'), false); assert.ok(text.includes('safe-request-id'));
});

test('patch route validates the target and body, then audits only sharing and status changes (forwarding enabled)', async () => {
  process.env.WORKER_INQUIRY_FORWARDING = 'on';
  try {
  for (const [body, target] of [[undefined, {}], [{}, {}], [{ forward: false }, {}], [{ adminStatus: 'closed' }, { kind: 'rental_inquiry' }], [{ adminStatus: 'closed' }, { id: 'invalid' }]]) {
    const api = route('patch');
    assert.equal((await api.patch(body, target)).status, 400, JSON.stringify([body, target]));
    assert.equal(api.log.some(entry => entry[0] === 'update'), false);
  }
  const forward = route('patch');
  assert.equal((await forward.patch({ forward: true })).status, 200);
  assert.deepEqual(plain(forward.log.find(entry => entry[0] === 'update')), ['update', 'insurance_inquiry', ID, { forward: true }, ADMIN_ID]);
  const audit = forward.log.find(entry => entry[0] === 'audit');
  assert.equal(audit[2], 'worker_inquiry.forward');
  assert.equal(JSON.stringify(audit).includes('0901234567'), false);
  const status = route('patch');
  await status.patch({ adminStatus: 'closed' });
  assert.equal(status.log.find(entry => entry[0] === 'audit')[2], 'worker_inquiry.status');
  const note = route('patch');
  await note.patch({ adminNote: 'đã gọi' });
  assert.equal(note.log.some(entry => entry[0] === 'audit'), false);
  for (const status of [404, 409, 503]) {
    const refused = route('patch', { update: { ok: false, error: 'Bị từ chối', status } });
    const response = await refused.patch({ forward: true });
    assert.equal(response.status, status);
    assert.equal(refused.log.some(entry => entry[0] === 'audit'), false);
  }
  const denied = route('patch', { allowed: false });
  assert.equal((await denied.patch({ forward: true })).status, 403);
  assert.equal(denied.log.some(entry => entry[0] === 'update'), false);
  } finally { delete process.env.WORKER_INQUIRY_FORWARDING; }
});

test('forwarding is off by default: the patch route refuses it and the list reports it', async () => {
  delete process.env.WORKER_INQUIRY_FORWARDING;
  const off = route('patch');
  const response = await off.patch({ forward: true });
  assert.equal(response.status, 403);
  assert.equal(off.log.some(entry => entry[0] === 'update' || entry[0] === 'audit'), false);
  const mixed = route('patch');
  assert.equal((await mixed.patch({ forward: true, adminStatus: 'closed' })).status, 403);
  assert.equal(mixed.log.some(entry => entry[0] === 'update'), false);
  const note = route('patch');
  assert.equal((await note.patch({ adminNote: 'chỉ ghi chú' })).status, 200);
  const list = route('list');
  assert.equal((await (await list.get()).json()).forwardingEnabled, false);
  process.env.WORKER_INQUIRY_FORWARDING = 'on';
  try { assert.equal((await (await route('list').get()).json()).forwardingEnabled, true); } finally { delete process.env.WORKER_INQUIRY_FORWARDING; }
});

// ── Quy tắc chuyển yêu cầu ──
function service({ current, writeResult = { data: { id: ID }, error: null }, itemResult = { data: row, error: null }, readError = null }) {
  const calls = [];
  const dependencies = {
    'server-only': {},
    '@/lib/supabase/safe-error-log': { logSafeSupabaseError: () => 'safe-request-id' },
    '@/lib/worker-inquiries': inquiries,
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => ({ from: table => {
      const query = { table, ops: [] };
      for (const method of ['select', 'eq', 'update']) query[method] = (...args) => { query.ops.push([method, ...args]); return query; };
      query.maybeSingle = async () => {
        calls.push(plain(query));
        if (table === 'admin_worker_inquiries') return itemResult;
        return query.ops.some(op => op[0] === 'update') ? writeResult : { data: current, error: readError };
      };
      return query;
    } }) },
  };
  const { updateWorkerInquiry } = load('../src/lib/admin-worker-inquiries.ts', dependencies);
  return { updateWorkerInquiry, calls };
}

test('forwarding moves a request to the partner once, with a conditional write and the acting admin', async () => {
  const api = service({ current: { id: ID, routed_to: 'admin', admin_status: 'contacted' } });
  const result = await api.updateWorkerInquiry('insurance_inquiry', ID, { forward: true, adminNote: 'đã tư vấn' }, ADMIN_ID);
  assert.equal(result.ok, true); assert.equal(result.forwarded, true);
  const write = api.calls.find(call => call.ops.some(op => op[0] === 'update'));
  assert.equal(write.table, 'insurance_inquiries');
  const update = write.ops.find(op => op[0] === 'update')[1];
  assert.equal(update.routed_to, 'provider'); assert.equal(update.forwarded_by, ADMIN_ID); assert.equal(update.admin_note, 'đã tư vấn');
  assert.ok(typeof update.forwarded_at === 'string');
  assert.ok(write.ops.some(op => op[0] === 'eq' && op[1] === 'routed_to' && op[2] === 'admin'), 'chỉ ghi khi còn ở Admin');
});

test('forwarding refuses requests that are already forwarded, closed or missing, and detects concurrent changes', async () => {
  const forwardedRow = { id: ID, routed_to: 'provider', admin_status: 'contacted' };
  assert.equal((await service({ current: forwardedRow }).updateWorkerInquiry('finance_inquiry', ID, { forward: true }, ADMIN_ID)).status, 409);
  assert.equal((await service({ current: forwardedRow }).updateWorkerInquiry('finance_inquiry', ID, { adminStatus: 'closed' }, ADMIN_ID)).status, 409);
  const noteOnly = await service({ current: forwardedRow }).updateWorkerInquiry('finance_inquiry', ID, { adminNote: 'ghi chú sau khi chuyển' }, ADMIN_ID);
  assert.equal(noteOnly.ok, true, 'vẫn ghi chú được sau khi chuyển');
  const closed = { id: ID, routed_to: 'admin', admin_status: 'closed' };
  assert.equal((await service({ current: closed }).updateWorkerInquiry('vocational_inquiry', ID, { forward: true }, ADMIN_ID)).status, 409);
  assert.equal((await service({ current: closed }).updateWorkerInquiry('vocational_inquiry', ID, { forward: true, adminStatus: 'new' }, ADMIN_ID)).ok, true);
  assert.equal((await service({ current: null }).updateWorkerInquiry('vocational_application', ID, { adminStatus: 'closed' }, ADMIN_ID)).status, 404);
  const raced = await service({ current: { id: ID, routed_to: 'admin', admin_status: 'new' }, writeResult: { data: null, error: null } }).updateWorkerInquiry('insurance_inquiry', ID, { forward: true }, ADMIN_ID);
  assert.equal(raced.status, 409);
  const unreadable = await service({ current: null, readError: { code: '08006', message: 'private diagnostics' } }).updateWorkerInquiry('insurance_inquiry', ID, { adminStatus: 'closed' }, ADMIN_ID);
  assert.equal(unreadable.status, 503); assert.equal(JSON.stringify(unreadable).includes('private diagnostics'), false);
  const writeFailed = await service({ current: { id: ID, routed_to: 'admin', admin_status: 'new' }, writeResult: { data: null, error: { code: '08006', message: 'private diagnostics' } } }).updateWorkerInquiry('insurance_inquiry', ID, { adminStatus: 'closed' }, ADMIN_ID);
  assert.equal(writeFailed.status, 503); assert.equal(JSON.stringify(writeFailed).includes('private diagnostics'), false);
});
