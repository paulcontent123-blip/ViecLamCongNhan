import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as bugReports from '../src/lib/bug-reports.ts';
import { parseEmployerListParams } from '../src/lib/mobile-employer-list-params.ts';

const localRequire = createRequire(import.meta.url);
const plain = value => JSON.parse(JSON.stringify(value));
const nextServer = { NextResponse: { json: (body, init = {}) => new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } }) } };
const ID = '11111111-1111-4111-8111-111111111111';
const USER = 'user-1';
const ADMIN = 'admin-1';

// Nạp một tệp TypeScript của dự án vào vm với các mô-đun giả lập.
function load(path, dependencies) {
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: key => dependencies[key] ?? localRequire(key), Error, RangeError, Response, URLSearchParams, URL, Buffer, Date, Promise, console: { error: () => {} } });
  return exports;
}

const valid = { role: 'candidate', title: 'App bị treo', description: 'Mở màn Điểm thì app đứng yên không bấm được.' };

// ── Schema ──
test('bug report create schema trims text, accepts optional app info and refuses extra fields', () => {
  const schema = bugReports.bugReportCreateSchema;
  const parsed = schema.parse({ ...valid, title: '  App bị treo  ', appVersion: '1.0.0', platform: 'android' });
  assert.equal(parsed.title, 'App bị treo'); assert.equal(parsed.appVersion, '1.0.0');
  for (const role of bugReports.BUG_REPORT_ROLES) assert.equal(schema.safeParse({ ...valid, role }).success, true, role);
  const bad = [{ ...valid, role: 'admin' }, { ...valid, title: 'ab' }, { ...valid, title: 'a'.repeat(101) }, { ...valid, description: 'ngắn' }, { ...valid, description: 'a'.repeat(2001) },
    { ...valid, platform: 'windows' }, { ...valid, appVersion: '1.0 0' }, { ...valid, appVersion: 'a'.repeat(31) }, { ...valid, userId: 'someone-else' }, { ...valid, status: 'resolved' }, {}, null, 'x'];
  for (const body of bad) assert.equal(schema.safeParse(body).success, false, JSON.stringify(body));
});

test('bug report patch schema needs at least one field and a known status', () => {
  const schema = bugReports.bugReportPatchSchema;
  for (const body of [{ status: 'resolved' }, { adminNote: null }, { adminNote: '  đã sửa  ' }, { status: 'closed', adminNote: 'trùng' }]) assert.equal(schema.safeParse(body).success, true, JSON.stringify(body));
  assert.equal(schema.parse({ adminNote: '  đã sửa  ' }).adminNote, 'đã sửa');
  for (const body of [{}, { status: 'deleted' }, { adminNote: 'a'.repeat(1001) }, { reporter_user_id: 'x' }, null]) assert.equal(schema.safeParse(body).success, false, JSON.stringify(body));
});

test('flatten puts the reporter name at the top level', () => {
  const row = { id: ID, title: 't', reporter: { full_name: 'Nguyễn A' } };
  assert.deepEqual(plain(bugReports.flattenBugReport(row)), { id: ID, title: 't', reporter_name: 'Nguyễn A' });
  assert.equal(bugReports.flattenBugReport({ id: ID, reporter: [{ full_name: 'B' }] }).reporter_name, 'B');
  assert.equal(bugReports.flattenBugReport({ id: ID, reporter: null }).reporter_name, null);
});

// ── Route gửi báo lỗi ──
function createRoute({ sessionFor = {}, same = { data: [], error: null }, recent = { count: 0, error: null }, insert = { data: { id: ID }, error: null } } = {}) {
  const log = [];
  const readers = {};
  for (const role of bugReports.BUG_REPORT_ROLES) {
    readers[role] = async (...args) => { log.push(['session', role, ...plain(args)]); const value = sessionFor[role]; if (value instanceof Error) throw value; return value === undefined ? null : value; };
  }
  const client = {
    from(table) {
      log.push(['from', table]);
      const query = {};
      let mode = 'duplicate';
      query.select = (columns, options) => { if (options && options.head) mode = 'count'; log.push(['select', columns, options && options.head ? 'head' : '']); return query; };
      for (const method of ['eq', 'gte', 'limit']) query[method] = (...args) => { log.push([method, ...args]); return query; };
      query.insert = row => { mode = 'insert'; log.push(['insert', plain(row)]); return query; };
      query.single = async () => insert;
      query.then = (resolve, reject) => Promise.resolve(mode === 'count' ? recent : same).then(resolve, reject);
      return query;
    },
  };
  const route = load('../src/app/api/mobile/bug-reports/route.ts', {
    'next/server': nextServer,
    '@/lib/candidate-auth': { getCandidateSession: readers.candidate },
    '@/lib/employer-auth': { getEmployerSession: readers.employer },
    '@/lib/training-provider-auth': { getTrainingProviderSession: readers.training_provider },
    '@/lib/rental-provider-auth': { getRentalProviderSession: readers.rental_provider },
    '@/lib/insurance-provider-auth': { getInsuranceProviderSession: readers.insurance_provider },
    '@/lib/finance-provider-auth': { getFinanceProviderSession: readers.finance_provider },
    '@/lib/health-provider-auth': { getHealthProviderSession: readers.health_provider },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => client },
    '@/lib/supabase/safe-error-log': { logSafeSupabaseError: () => 'safe-request-id' },
    '@/lib/bug-reports': bugReports,
  });
  return { log, post: body => route.POST({ json: async () => { if (body === undefined) throw new Error('no body'); return body; } }) };
}
const ok = { candidate: { userId: USER } };

test('sending a bug report validates first, then reads only the session of the stated role', async () => {
  for (const body of [undefined, {}, { ...valid, title: 'ab' }, { ...valid, role: 'admin' }, { ...valid, userId: 'x' }]) {
    const api = createRoute({ sessionFor: ok });
    assert.equal((await api.post(body)).status, 400, JSON.stringify(body));
    assert.equal(api.log.length, 0);
  }
  for (const role of bugReports.BUG_REPORT_ROLES) {
    const api = createRoute({ sessionFor: { [role]: { userId: USER } } });
    assert.equal((await api.post({ ...valid, role })).status, 201, role);
    assert.deepEqual(api.log.filter(entry => entry[0] === 'session').map(entry => entry.slice(0, 2)), [['session', role]], role);
  }
});

// Lỗi đã gặp: công nhân đăng nhập bằng mật khẩu nhưng chưa xác minh số điện thoại bị báo "cần đăng nhập" vì route không bật phép này.
test('a worker signed in by password with an unverified phone can send a bug report, like on every other worker route', async () => {
  const api = createRoute({ sessionFor: ok });
  assert.equal((await api.post(valid)).status, 201);
  assert.deepEqual(api.log.find(entry => entry[0] === 'session'), ['session', 'candidate', { allowUnverifiedPasswordSession: true }]);
});

test('a missing, failing or wrong-role session is 401 and nothing is stored', async () => {
  for (const sessionFor of [{}, { candidate: null }, { candidate: new Error('boom') }, { employer: { userId: USER } }]) {
    const api = createRoute({ sessionFor });
    const response = await api.post(valid);
    assert.equal(response.status, 401);
    assert.equal(api.log.some(entry => entry[0] === 'insert' || entry[0] === 'from'), false);
  }
});

test('a new report stores the reporter from the session and the app info, nothing from the client', async () => {
  const api = createRoute({ sessionFor: ok });
  const response = await api.post({ ...valid, appVersion: '1.0.0', platform: 'android' });
  assert.equal(response.status, 201);
  assert.deepEqual(plain(await response.json()), { ok: true, id: ID });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(api.log.find(entry => entry[0] === 'insert')[1], { reporter_user_id: USER, reporter_role: 'candidate', title: valid.title, description: valid.description, app_version: '1.0.0', platform: 'android' });
  const bare = createRoute({ sessionFor: ok });
  await bare.post(valid);
  const row = bare.log.find(entry => entry[0] === 'insert')[1];
  assert.equal(row.app_version, null); assert.equal(row.platform, null);
});

test('the same report sent again within minutes returns the first one instead of a duplicate', async () => {
  const api = createRoute({ sessionFor: ok, same: { data: [{ id: 'old-id' }], error: null }, recent: { count: 99, error: null } });
  const response = await api.post(valid);
  assert.equal(response.status, 200);
  assert.deepEqual(plain(await response.json()), { ok: true, id: 'old-id', duplicate: true });
  assert.equal(api.log.some(entry => entry[0] === 'insert'), false);
  const dup = api.log.filter(entry => entry[0] === 'eq');
  assert.ok(dup.some(entry => entry[1] === 'reporter_user_id' && entry[2] === USER));
  assert.ok(dup.some(entry => entry[1] === 'title') && dup.some(entry => entry[1] === 'description'));
});

test('too many reports in a day are refused with 429', async () => {
  const blocked = createRoute({ sessionFor: ok, recent: { count: bugReports.BUG_REPORT_DAILY_LIMIT, error: null } });
  const response = await blocked.post(valid);
  assert.equal(response.status, 429);
  assert.equal(blocked.log.some(entry => entry[0] === 'insert'), false);
  const allowed = createRoute({ sessionFor: ok, recent: { count: bugReports.BUG_REPORT_DAILY_LIMIT - 1, error: null } });
  assert.equal((await allowed.post(valid)).status, 201);
});

test('database failures are 503 with a request id and never leak details', async () => {
  for (const options of [{ same: { data: null, error: { message: 'secret db detail' } } }, { recent: { count: null, error: { message: 'secret db detail' } } }, { insert: { data: null, error: { message: 'secret db detail' } } }]) {
    const api = createRoute({ sessionFor: ok, ...options });
    const response = await api.post(valid);
    assert.equal(response.status, 503);
    const text = JSON.stringify(await response.json());
    assert.equal(text.includes('secret db detail'), false); assert.ok(text.includes('safe-request-id'));
  }
});

// ── Route Admin ──
function adminRoutes({ auth = 'ok', list = { data: [], count: 0, error: null }, pending = { count: 0, error: null }, update = { data: null, error: null } } = {}) {
  const log = [];
  const client = {
    from(table) {
      log.push(['from', table]);
      const query = {};
      let head = false;
      let updating = false;
      query.select = (columns, options) => { if (options && options.head) head = true; log.push(['select', columns]); return query; };
      for (const method of ['order', 'eq']) query[method] = (...args) => { log.push([method, ...args]); return query; };
      query.update = row => { updating = true; log.push(['update', plain(row)]); return query; };
      query.range = async (...args) => { log.push(['range', ...args]); return list; };
      query.maybeSingle = async () => update;
      query.then = (resolve, reject) => Promise.resolve(updating ? update : head ? pending : list).then(resolve, reject);
      return query;
    },
  };
  const dependencies = {
    'next/server': nextServer,
    '@/lib/admin-auth': { requireAdmin: async capability => {
      log.push(['requireAdmin', capability]);
      return auth === 'ok' ? { session: { userId: ADMIN, adminRole: 'editor' } } : { error: new Response('{}', { status: auth === 'anonymous' ? 401 : 403 }) };
    } },
    '@/lib/admin-audit': { logAdminAction: async (...args) => { log.push(['audit', ...args.slice(1)]); } },
    '@/lib/mobile-employer-list-params': { parseEmployerListParams },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => client },
    '@/lib/supabase/safe-error-log': { logSafeSupabaseError: () => 'safe-request-id' },
    '@/lib/bug-reports': bugReports,
  };
  const listRoute = load('../src/app/api/mobile/admin/bug-reports/route.ts', dependencies);
  const patchRoute = load('../src/app/api/mobile/admin/bug-reports/[id]/route.ts', dependencies);
  return {
    log,
    get: (query = '') => listRoute.GET({ nextUrl: new URL(`https://example.com/api/mobile/admin/bug-reports?${query}`) }),
    patch: (body, id = ID) => patchRoute.PATCH({ json: async () => { if (body === undefined) throw new Error('no body'); return body; } }, { params: Promise.resolve({ id }) }),
  };
}
const row = { id: ID, reporter_role: 'candidate', title: 'App bị treo', description: 'Mở màn Điểm thì app đứng yên.', app_version: '1.0.0', platform: 'android', status: 'new', admin_note: null, created_at: '2026-11-03T03:00:00Z', updated_at: '2026-11-03T03:00:00Z', handled_at: null, reporter: { full_name: 'Nguyễn A' } };

test('admin list needs an admin session, is paged and filtered, and shows the reporter name', async () => {
  for (const auth of ['anonymous', 'forbidden']) {
    const api = adminRoutes({ auth });
    const response = await api.get();
    assert.equal(response.status, auth === 'anonymous' ? 401 : 403);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(api.log.some(entry => entry[0] === 'from'), false);
  }
  const api = adminRoutes({ list: { data: [row], count: 21, error: null }, pending: { count: 4, error: null } });
  const response = await api.get('page=2&pageSize=20&status=new');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, 21); assert.equal(body.newCount, 4); assert.equal(body.page, 2);
  assert.equal(body.items[0].reporter_name, 'Nguyễn A'); assert.equal('reporter' in body.items[0], false);
  assert.deepEqual(api.log.find(entry => entry[0] === 'requireAdmin'), ['requireAdmin', undefined]); // mọi cấp Admin
  assert.ok(api.log.some(entry => entry[0] === 'eq' && entry[1] === 'status' && entry[2] === 'new'));
  assert.deepEqual(api.log.find(entry => entry[0] === 'range'), ['range', 20, 39]);
  for (const query of ['page=0', 'status=deleted', 'pageSize=51']) assert.equal((await adminRoutes().get(query)).status, 400, query);
  const failing = adminRoutes({ list: { data: null, count: null, error: { message: 'secret db detail' } } });
  const failed = await failing.get();
  assert.equal(failed.status, 503);
  assert.equal(JSON.stringify(await failed.json()).includes('secret db detail'), false);
});

test('admin update validates input, stamps who handled a status change and audits only status changes', async () => {
  for (const [body, id] of [[undefined, ID], [{}, ID], [{ status: 'x' }, ID], [{ status: 'closed' }, 'khong-phai-uuid']]) {
    const api = adminRoutes();
    assert.equal((await api.patch(body, id)).status, 400, JSON.stringify([body, id]));
    assert.equal(api.log.some(entry => entry[0] === 'update'), false);
  }
  const statusApi = adminRoutes({ update: { data: { ...row, status: 'resolved' }, error: null } });
  const response = await statusApi.patch({ status: 'resolved', adminNote: '  đã sửa ở bản 1.0.1  ' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).item.reporter_name, 'Nguyễn A');
  const saved = statusApi.log.find(entry => entry[0] === 'update')[1];
  assert.equal(saved.status, 'resolved'); assert.equal(saved.handled_by, ADMIN); assert.ok(saved.handled_at); assert.equal(saved.admin_note, 'đã sửa ở bản 1.0.1');
  const audit = statusApi.log.find(entry => entry[0] === 'audit');
  assert.equal(audit[1], 'bug_report.status'); assert.equal(audit[3].status, 'resolved');
  assert.equal(JSON.stringify(audit).includes('Mở màn Điểm'), false);
  const noteApi = adminRoutes({ update: { data: row, error: null } });
  await noteApi.patch({ adminNote: '   ' });
  const noteRow = noteApi.log.find(entry => entry[0] === 'update')[1];
  assert.equal(noteRow.admin_note, null); assert.equal('status' in noteRow, false); assert.equal('handled_by' in noteRow, false);
  assert.equal(noteApi.log.some(entry => entry[0] === 'audit'), false);
});

test('admin update reports a missing report as 404 and hides database errors', async () => {
  assert.equal((await adminRoutes({ update: { data: null, error: null } }).patch({ status: 'closed' })).status, 404);
  const broken = adminRoutes({ update: { data: null, error: { message: 'secret db detail' } } });
  const response = await broken.patch({ status: 'closed' });
  assert.equal(response.status, 503);
  assert.equal(JSON.stringify(await response.json()).includes('secret db detail'), false);
  assert.equal(broken.log.some(entry => entry[0] === 'audit'), false);
  const denied = adminRoutes({ auth: 'forbidden' });
  assert.equal((await denied.patch({ status: 'closed' })).status, 403);
  assert.equal(denied.log.some(entry => entry[0] === 'update'), false);
});
