import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as inquiries from '../src/lib/worker-inquiries.ts';
import * as provinces from '../src/lib/provinces.ts';
import { normalizePhone } from '../src/lib/phone.ts';
import { adminCan, ADMIN_CAPABILITIES } from '../src/lib/admin-roles.ts';

const localRequire = createRequire(import.meta.url);
const plain = value => JSON.parse(JSON.stringify(value));
const nextServer = { NextResponse: { json: (body, init = {}) => new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } }) } };
const ROW_ID = '11111111-1111-4111-8111-111111111111';

// Nạp một tệp TypeScript của dự án vào vm với các mô-đun giả lập (RangeError, URLSearchParams... lấy từ môi trường chạy test).
function load(path, dependencies) {
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: key => dependencies[key] ?? localRequire(key), Error, RangeError, Response, URLSearchParams, URL, Buffer, Date, Promise, console: { error: () => {} } });
  return exports;
}
const lead = load('../src/lib/lead-export.ts', { '@/lib/worker-inquiries': inquiries, '@/lib/provinces': provinces, '@/lib/phone': { normalizePhone } });
const params = query => new URLSearchParams(query);
const filtersOf = query => inquiries.parseWorkerInquiryFilters(params(query));
const noExtras = { category: '', province: '' };

const finance = { kind: 'finance_inquiry', id: ROW_ID, full_name: 'Nguyễn Văn A', phone: '+84 901 234 567', subject: 'Vay tiêu dùng nhanh', extra: { category: 'consumer_loan', province_code: 'HCM' }, created_at: '2026-11-02T03:00:00Z' };

// ── Quyền và đồng ý chia sẻ ──
test('lead export is a superadmin-only capability', () => {
  assert.ok(ADMIN_CAPABILITIES.includes('lead_export'));
  assert.equal(adminCan('superadmin', 'lead_export'), true);
  assert.equal(adminCan('editor', 'lead_export'), false);
});

test('share consent is recorded only when the worker explicitly ticked it', () => {
  assert.deepEqual(plain(lead.shareConsentColumns(undefined)), {});
  assert.deepEqual(plain(lead.shareConsentColumns(false)), {});
  const columns = lead.shareConsentColumns(true, new Date('2026-11-02T01:00:00Z'));
  assert.equal(columns.share_consent_at, '2026-11-02T01:00:00.000Z');
  assert.equal(columns.share_consent_version, lead.LEAD_SHARE_CONSENT_VERSION);
});

// ── Bộ lọc bổ sung và truy vấn ──
test('extra filters accept finance categories and provinces only for finance requests', () => {
  assert.deepEqual(plain(lead.parseLeadExtras(params(''), '')), noExtras);
  assert.deepEqual(plain(lead.parseLeadExtras(params('category=consumer_loan&province=HCM'), 'finance_inquiry')), { category: 'consumer_loan', province: 'HCM' });
  assert.deepEqual(plain(lead.parseLeadExtras(params('category=ewa'), '')), { category: 'ewa', province: '' });
  for (const [query, kind] of [['category=crypto', ''], ['province=%27%3Bdrop', ''], ['category=ewa', 'insurance_inquiry'], ['province=HCM', 'vocational_application']]) {
    assert.throws(() => lead.parseLeadExtras(params(query), kind), RangeError, query);
  }
});

function recorder() {
  const calls = [];
  const query = {};
  for (const method of ['select', 'eq', 'not', 'or']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  return { calls, client: { from: table => { calls.push(['from', table]); return query; } } };
}

test('export query takes only consented requests still at the admin queue and applies the page filters', () => {
  const { calls, client } = recorder();
  lead.leadExportQuery(client, filtersOf('kind=finance_inquiry&status=new&q=vay+nhanh'), { category: 'consumer_loan', province: 'HCM' });
  assert.deepEqual(calls[0], ['from', 'admin_worker_inquiries']);
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'routed_to' && c[2] === 'admin'));
  assert.ok(calls.some(c => c[0] === 'not' && c[1] === 'share_consent_at' && c[2] === 'is' && c[3] === null));
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'kind' && c[2] === 'finance_inquiry'));
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'admin_status' && c[2] === 'new'));
  assert.ok(calls.some(c => c[0] === 'or' && ['full_name', 'phone', 'subject', 'provider_name'].every(column => c[1].includes(`${column}.ilike.%vay nhanh%`))));
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'extra->>category' && c[2] === 'consumer_loan'));
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'extra->>province_code' && c[2] === 'HCM'));
});

test('export query ignores the queue tab: a request already forwarded to a partner is never exported', () => {
  const { calls, client } = recorder();
  lead.leadExportQuery(client, filtersOf('routed=all'), noExtras, { head: true });
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'routed_to' && c[2] === 'admin'));
  assert.deepEqual(plain(calls.find(c => c[0] === 'select').slice(2)), [{ count: 'exact', head: true }]);
});

// ── Tệp CSV ──
test('csv has a BOM, only the agreed columns, spaced phone numbers and no formula injection', () => {
  const csv = lead.buildLeadCsv([
    finance,
    { kind: 'vocational_inquiry', id: 'v1', full_name: '=HYPERLINK("http://x")', phone: '0911222333', subject: 'Khóa "hàn" cơ bản\nlớp tối', extra: null, created_at: '2026-10-30T00:00:00Z' },
    { kind: 'insurance_inquiry', id: 'i1', full_name: '-2+3', phone: '84911222333', subject: null, extra: null, created_at: '2026-10-29T00:00:00Z', email: 'a@b.vn', message: 'riêng tư', admin_note: 'ghi chú' },
  ]);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  const lines = csv.slice(1).trim().split('\r\n');
  assert.equal(lines[0], '"Họ tên","Số điện thoại","Tỉnh/thành","Loại nhu cầu","Nhu cầu","Ngày gửi"');
  assert.match(lines[1], /^"Nguyễn Văn A","0901 234 567","[^"]+","Tài chính · Vay tiêu dùng","Vay tiêu dùng nhanh","2026-11-02"$/);
  assert.ok(lines[2].startsWith('"\'=HYPERLINK(""http://x"")","0911 222 333"'));
  assert.ok(lines[2].includes('Khóa ""hàn"" cơ bản lớp tối'));
  assert.ok(lines[3].startsWith('"\'-2+3","0911 222 333"'));
  for (const secret of ['a@b.vn', 'riêng tư', 'ghi chú']) assert.equal(csv.includes(secret), false, secret);
  assert.equal(lines.length, 4);
});

// ── Route xuất ──
function exportRoute({ auth = 'ok', result = { data: [finance], error: null } } = {}) {
  const log = [];
  const query = {};
  for (const method of ['select', 'eq', 'not', 'or', 'order']) query[method] = (...args) => { log.push(['q', method, ...args]); return query; };
  query.limit = (...args) => { log.push(['q', 'limit', ...args]); return query; };
  query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  const session = { userId: 'admin-1', email: 'admin@example.com', adminRole: 'superadmin' };
  const route = load('../src/app/api/admin/lead-exports/route.ts', {
    'next/server': nextServer,
    '@/lib/admin-auth': { requireAdmin: async capability => {
      log.push(['requireAdmin', capability]);
      if (auth === 'ok') return { session };
      return { error: new Response('{}', { status: auth === 'anonymous' ? 401 : 403 }) };
    } },
    '@/lib/admin-audit': { logAdminAction: async (...args) => { log.push(['audit', ...args.slice(1)]); } },
    '@/lib/lead-export': lead,
    '@/lib/worker-inquiries': inquiries,
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => { log.push(['db']); return { from: () => query }; } },
    '@/lib/supabase/safe-error-log': { logSafeSupabaseError: () => 'safe-request-id' },
  });
  return { log, post: body => route.POST({ json: async () => { if (body === undefined) throw new Error('no body'); return body; } }) };
}
const valid = { partnerName: 'Công ty ABC', filters: { kind: 'finance_inquiry', category: 'consumer_loan' } };

test('export route requires the lead_export capability before touching data', async () => {
  for (const auth of ['anonymous', 'editor']) {
    const api = exportRoute({ auth });
    assert.equal((await api.post(valid)).status, auth === 'anonymous' ? 401 : 403);
    assert.deepEqual(api.log.find(entry => entry[0] === 'requireAdmin'), ['requireAdmin', 'lead_export']);
    assert.equal(api.log.some(entry => entry[0] === 'db'), false);
  }
});

test('export route validates the partner and filters and refuses unknown fields', async () => {
  const bad = [undefined, {}, { ...valid, partnerName: 'A' }, { ...valid, partnerName: 'x'.repeat(121) }, { ...valid, limit: 5 }, { ...valid, filters: { routed: 'all' } },
    { ...valid, filters: { kind: 'rental_inquiry' } }, { ...valid, filters: { status: 'resolved' } }, { ...valid, filters: { kind: 'insurance_inquiry', province: 'HCM' } }, { ...valid, filters: { category: 'crypto' } }];
  for (const body of bad) {
    const api = exportRoute();
    assert.equal((await api.post(body)).status, 400, JSON.stringify(body));
    assert.equal(api.log.some(entry => entry[0] === 'db'), false);
  }
});

test('export route returns a csv attachment and audits the export without personal data', async () => {
  const api = exportRoute();
  const response = await api.post(valid);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/csv/);
  assert.match(response.headers.get('content-disposition'), /^attachment; filename="du-lieu-lien-he-\d{4}-\d{2}-\d{2}\.csv"$/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('x-row-count'), '1');
  assert.ok((await response.text()).includes('Nguyễn Văn A'));
  const queries = api.log.filter(entry => entry[0] === 'q');
  assert.ok(queries.some(entry => entry[1] === 'eq' && entry[2] === 'routed_to' && entry[3] === 'admin'));
  assert.ok(queries.some(entry => entry[1] === 'not' && entry[2] === 'share_consent_at'));
  assert.ok(queries.some(entry => entry[1] === 'order' && entry[2] === 'created_at' && entry[3].ascending === true));
  assert.ok(queries.some(entry => entry[1] === 'limit' && entry[2] === lead.LEAD_MAX_EXPORT + 1));
  const audit = api.log.find(entry => entry[0] === 'audit');
  assert.equal(audit[1], 'lead_export.create'); assert.equal(audit[3].partner, 'Công ty ABC'); assert.equal(audit[3].count, 1);
  assert.equal(audit[3].filters.category, 'consumer_loan');
  const text = JSON.stringify(audit);
  for (const secret of ['Nguyễn Văn A', '0901', '+84']) assert.equal(text.includes(secret), false, secret);
});

test('export route reports nothing to export, too many rows and read failures without auditing', async () => {
  const none = exportRoute({ result: { data: [], error: null } });
  assert.equal((await none.post(valid)).status, 404);
  const many = exportRoute({ result: { data: Array.from({ length: lead.LEAD_MAX_EXPORT + 1 }, (_, index) => ({ ...finance, id: `r${index}` })), error: null } });
  const tooMany = await many.post(valid);
  assert.equal(tooMany.status, 400);
  assert.match((await tooMany.json()).error, /thu hẹp bộ lọc/);
  const broken = exportRoute({ result: { data: null, error: { message: 'secret db detail' } } });
  const failed = await broken.post(valid);
  assert.equal(failed.status, 503);
  const text = JSON.stringify(await failed.json());
  assert.equal(text.includes('secret db detail'), false); assert.ok(text.includes('safe-request-id'));
  for (const api of [none, many, broken]) assert.equal(api.log.some(entry => entry[0] === 'audit'), false);
});

// ── Công nhân gửi yêu cầu: đồng ý chia sẻ chỉ được ghi khi tick rõ ràng ──
const UUID = '33333333-3333-4333-8333-333333333333';
function workerRoute(path, table) {
  const inserted = [];
  const entities = {
    vocational_courses: { id: UUID, provider_id: 'p1', title: 'Hàn cơ bản', status: 'approved', training_providers: { is_verified: true } },
    insurance_products: { id: UUID, provider_id: 'p1', status: 'approved', insurance_providers: { is_verified: true } },
    finance_products: { id: UUID, provider_id: 'p1', category: 'consumer_loan', title: 'Vay nhanh', status: 'approved', finance_providers: { provider_name: 'Đơn vị A', is_verified: true } },
  };
  const client = {
    from(name) {
      const query = {};
      for (const method of ['select', 'eq']) query[method] = () => query;
      query.maybeSingle = async () => ({ data: entities[name] ?? null, error: null });
      query.insert = payload => { inserted.push({ table: name, payload: plain(payload) }); return query; };
      query.single = async () => ({ data: { id: 'new-id', status: 'new', created_at: '2026-11-02T00:00:00Z' }, error: null });
      return query;
    },
  };
  const route = load(path, {
    'next/server': nextServer,
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => client },
    '@/lib/supabase/safe-error-log': { logSafeSupabaseError: () => 'safe-request-id' },
    '@/lib/candidate-auth': { getCandidateSession: async () => null },
    '@/lib/lead-export': lead,
  });
  return { inserted, post: body => route.POST({ json: async () => body }), table };
}
const WORKER_ROUTES = [
  ['vocational inquiry', '../src/app/api/mobile/vocational/inquiries/route.ts', 'vocational_inquiries', { courseId: UUID, fullName: 'Nguyễn Văn A', phone: '0901234567' }],
  ['vocational application', '../src/app/api/mobile/vocational/applications/route.ts', 'vocational_applications', { courseId: UUID, fullName: 'Nguyễn Văn A', phone: '0901234567' }],
  ['insurance inquiry', '../src/app/api/mobile/insurance/inquiries/route.ts', 'insurance_inquiries', { productId: UUID, fullName: 'Nguyễn Văn A', phone: '0901234567', contactConsent: true }],
  ['finance inquiry', '../src/app/api/mobile/finance/inquiries/route.ts', 'finance_inquiries', { productId: UUID, topic: 'eligibility', fullName: 'Nguyễn Văn A', phone: '0901234567', contactConsent: true }],
];
for (const [name, path, table, body] of WORKER_ROUTES) {
  test(`${name} stores the sharing consent only when explicitly ticked`, async () => {
    const ticked = workerRoute(path, table);
    assert.equal((await ticked.post({ ...body, shareConsent: true })).status, 201);
    const saved = ticked.inserted.find(entry => entry.table === table).payload;
    assert.ok(typeof saved.share_consent_at === 'string'); assert.equal(saved.share_consent_version, lead.LEAD_SHARE_CONSENT_VERSION);
    for (const extra of [{}, { shareConsent: false }]) {
      const plainRequest = workerRoute(path, table);
      assert.equal((await plainRequest.post({ ...body, ...extra })).status, 201, JSON.stringify(extra));
      const row = plainRequest.inserted.find(entry => entry.table === table).payload;
      assert.equal('share_consent_at' in row, false); assert.equal('share_consent_version' in row, false);
    }
    const invalid = workerRoute(path, table);
    assert.equal((await invalid.post({ ...body, shareConsent: 'yes' })).status, 400);
    assert.equal(invalid.inserted.length, 0);
  });
}
