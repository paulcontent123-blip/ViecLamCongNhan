import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as accounts from '../src/lib/mobile-admin-users.ts';
import { parseEmployerListParams } from '../src/lib/mobile-employer-list-params.ts';
import { isSessionRevoked, SESSION_REVOCATION_SKEW_SECONDS } from '../src/lib/session-revocation.ts';

const id = '11111111-1111-4111-8111-111111111111';
const user = { id, full_name: 'Tài khoản thử', email: null, phone: '0901234567', role: 'training_provider', admin_role: null, status: 'active', is_verified: false, created_at: '2026-11-02T00:00:00Z' };
const localRequire = createRequire(import.meta.url);

// Đối tượng tạo trong vm khác nguyên mẫu với đối tượng của test; so sánh qua JSON.
const plain = value => JSON.parse(JSON.stringify(value));
const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const candidateSnapshot = { full_name: 'Công nhân thử', email: null, phone: '0901234567', role: 'candidate', admin_role: null, status: 'active' };

// detail: false = danh sách, true = chi tiết, 'password' = đặt lại mật khẩu. actions.mutate thay kết quả của các thao tác ghi.
function route(detail, { allowed = true, unauthenticated = false, result = { data: [user], count: 1, error: null }, actions = {} } = {}) {
  let reads = 0;
  const log = [];
  const calls = [];
  const query = {};
  for (const method of ['select', 'eq', 'order', 'or']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  query.range = async (...args) => { calls.push(['range', ...args]); return result; };
  query.maybeSingle = async () => result;
  const dependencies = {
    'next/server': { NextResponse: { json: (body, init = {}) => new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } }) } },
    '@/lib/admin-auth': { requireAdmin: async capability => {
      assert.equal(capability, 'admin_users');
      return allowed ? { session: { userId: actorId, adminRole: 'superadmin' } } : { error: new Response('{}', { status: unauthenticated ? 401 : 403 }) };
    } },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => { reads++; return { from: table => { assert.equal(table, 'users'); return query; } }; } },
    '@/lib/supabase/safe-error-log': { logSafeSupabaseError: () => 'safe-request-id' },
    '@/lib/mobile-admin-users': accounts,
    '@/lib/mobile-employer-list-params': { parseEmployerListParams },
    '@/lib/admin': {
      createAdminUser: async (...args) => { log.push(['create', ...args]); return actions.mutate ?? { ok: true, user }; },
      softDeleteAdminUser: async (...args) => { log.push(['delete', ...args]); return actions.mutate ?? { ok: true }; },
    },
    '@/lib/admin-account-mutations': {
      mutateAdminAccount: async (...args) => { log.push(['update', ...args]); return actions.mutate ?? { ok: true, user }; },
      resetAccountPassword: async (...args) => { log.push(['reset', ...args]); return actions.mutate ?? { ok: true }; },
    },
    '@/lib/admin-audit': { logAdminAction: async (...args) => { log.push(['audit', ...args]); } },
    '@/lib/admin-session': { ADMIN_SESSION_COOKIE: 'admin_session', ADMIN_SESSION_MAX_AGE: 1, createAdminSessionToken: async () => 'token' },
  };
  const file = new URL(`../src/app/api/mobile/admin/users/${detail === 'password' ? '[id]/password/' : detail ? '[id]/' : ''}route.ts`, import.meta.url);
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: key => dependencies[key] ?? localRequire(key), Error, RangeError, Response, Buffer });
  const context = accountId => ({ params: Promise.resolve({ id: accountId }) });
  return {
    get: (queryString = '', accountId = id) => exports.GET({ nextUrl: new URL(`https://example.com/api/mobile/admin/users?${queryString}`) }, context(accountId)),
    // Gọi thao tác ghi; không truyền body thì json() lỗi như thân yêu cầu không đọc được.
    call: (method, { body, accountId = id } = {}) => exports[method]({ json: async () => { if (body === undefined) throw new Error('no body'); return body; }, nextUrl: new URL('https://example.com/api/mobile/admin/users') }, context(accountId)),
    reads: () => reads, calls, log,
  };
}

test('list and detail deny unauthenticated/editor requests before reading accounts', async () => {
  for (const detail of [false, true]) for (const unauthenticated of [false, true]) {
    const api = route(detail, { allowed: false, unauthenticated });
    const response = await api.get();
    assert.equal(response.status, unauthenticated ? 401 : 403);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(api.reads(), 0);
  }
});

test('mobile list filters and paginates, preserves partner roles, and excludes secrets', async () => {
  const api = route(false, { result: { data: [{ ...user, password_hash: 'never-return', token: 'private' }], count: 21, error: null } });
  const response = await api.get('page=2&pageSize=20&role=training_provider&status=active&q=test@example.com');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, 21); assert.equal(body.page, 2);
  assert.equal(body.items[0].role, 'training_provider');
  assert.equal('password_hash' in body.items[0], false); assert.equal('token' in body.items[0], false);
  assert.ok(api.calls.some(call => call[0] === 'range' && call[1] === 20 && call[2] === 39));
  assert.ok(api.calls.some(call => call[0] === 'select' && call[1] === accounts.MOBILE_ACCOUNT_FIELDS));
  assert.ok(api.calls.some(call => call[0] === 'or' && call[1].includes('test@example.com')));
});

test('invalid filters and paging return 400 without reading the database', async () => {
  for (const query of ['page=0', 'pageSize=51', 'status=invalid', 'role=invalid', 'role=candidate&adminRole=editor', 'adminRole=invalid', 'q=%25%25']) {
    const api = route(false); assert.equal((await api.get(query)).status, 400, query); assert.equal(api.reads(), 0);
  }
  const filters = accounts.parseAdminAccountFilters(new URLSearchParams('adminRole=editor&q=a%2Cb%28c%29'));
  assert.equal(filters.role, 'admin'); assert.equal(/[(),]/.test(filters.q), false);
});

test('detail distinguishes 404, validation and database errors without leaking diagnostics', async () => {
  const api = route(true, { result: { data: { ...user, password_hash: 'private' }, error: null } });
  assert.deepEqual((await (await api.get()).json()).user, user);
  assert.equal((await api.get('', 'invalid')).status, 400);
  assert.equal((await route(true, { result: { data: null, error: null } }).get()).status, 404);
  for (const detail of [false, true]) {
    const response = await route(detail, { result: { data: null, count: null, error: { code: '08006', message: 'private diagnostics' } } }).get();
    assert.equal(response.status, 503);
    const body = await response.json(); assert.equal(body.requestId, 'safe-request-id');
    assert.equal(JSON.stringify(body).includes('private diagnostics'), false);
  }
});

test('password reset and delete deny anonymous and editor requests before changing anything', async () => {
  for (const [detail, method] of [['password', 'POST'], [true, 'DELETE']]) for (const unauthenticated of [false, true]) {
    const api = route(detail, { allowed: false, unauthenticated });
    const response = await api.call(method, { body: { password: '12345678', expected: candidateSnapshot, ...(method === 'DELETE' ? { password: undefined } : {}) } });
    assert.equal(response.status, unauthenticated ? 401 : 403);
    assert.equal(api.log.length, 0);
  }
});

test('password reset validates input, hides the password and logs only the target role', async () => {
  const good = { password: 'MatKhau-moi-123', expected: candidateSnapshot };
  for (const [body, accountId] of [[undefined, id], [{ ...good, password: '1234567' }, id], [{ ...good, password: 'a'.repeat(73) }, id], [{ ...good, password: 'é'.repeat(37) }, id], [{ ...good, expected: { ...candidateSnapshot, extra: 1 } }, id], [{ ...good, unknown: true }, id], [good, 'invalid']]) {
    const api = route('password');
    assert.equal((await api.call('POST', { body, accountId })).status, 400, JSON.stringify(body));
    assert.equal(api.log.length, 0);
  }
  const api = route('password');
  const response = await api.call('POST', { body: good });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const text = JSON.stringify(await response.json());
  assert.deepEqual(JSON.parse(text), { ok: true });
  assert.deepEqual(plain(api.log[0]), ['reset', actorId, id, 'MatKhau-moi-123', candidateSnapshot]);
  const audit = api.log.find(entry => entry[0] === 'audit');
  assert.equal(audit[2], 'user.reset_password');
  assert.deepEqual(plain(audit.at(-1)), { role: 'candidate' });
  assert.equal(JSON.stringify(audit).includes('MatKhau-moi-123'), false);
});

test('password reset and delete report backend refusals without logging a success', async () => {
  for (const [detail, method] of [['password', 'POST'], [true, 'DELETE']]) for (const status of [403, 404, 409]) {
    const api = route(detail, { actions: { mutate: { ok: false, error: 'Bị từ chối', status } } });
    const response = await api.call(method, { body: method === 'POST' ? { password: '12345678', expected: candidateSnapshot } : { expected: candidateSnapshot } });
    assert.equal(response.status, status);
    assert.equal((await response.json()).error, 'Bị từ chối');
    assert.equal(api.log.some(entry => entry[0] === 'audit'), false);
  }
});

test('delete validates the snapshot, forwards it to the backend and logs the cleanup type', async () => {
  for (const [body, accountId] of [[undefined, id], [{}, id], [{ expected: { ...candidateSnapshot, status: 'other' } }, id], [{ expected: candidateSnapshot, force: true }, id], [{ expected: candidateSnapshot }, 'invalid']]) {
    const api = route(true);
    assert.equal((await api.call('DELETE', { body, accountId })).status, 400);
    assert.equal(api.log.length, 0);
  }
  for (const [snapshot, cleanup] of [[candidateSnapshot, 'candidate_full'], [{ ...candidateSnapshot, role: 'employer' }, 'soft']]) {
    const api = route(true);
    const response = await api.call('DELETE', { body: { expected: snapshot } });
    assert.equal(response.status, 200);
    assert.deepEqual(plain(api.log[0]), ['delete', id, actorId, snapshot]);
    assert.deepEqual(plain(api.log.find(entry => entry[0] === 'audit').at(-1)), { role: snapshot.role, cleanup });
  }
});

test('sessions issued before a password change are revoked, with a small clock tolerance', () => {
  const changed = '2026-11-02T10:00:00.000Z';
  const at = Date.parse(changed) / 1000;
  assert.equal(isSessionRevoked({ iat: at - 3600 }, changed), true);
  assert.equal(isSessionRevoked({ iat: at - SESSION_REVOCATION_SKEW_SECONDS - 1 }, changed), true);
  assert.equal(isSessionRevoked({ iat: at - SESSION_REVOCATION_SKEW_SECONDS }, changed), false);
  assert.equal(isSessionRevoked({ iat: at }, changed), false);
  assert.equal(isSessionRevoked({ iat: at + 60 }, changed), false);
  // Chưa từng đổi mật khẩu: không thu hồi; mốc hỏng hoặc phiên không có iat: từ chối.
  assert.equal(isSessionRevoked({ iat: 1 }, null), false);
  assert.equal(isSessionRevoked({}, undefined), false);
  assert.equal(isSessionRevoked({ iat: at }, 'khong-phai-ngay'), true);
  assert.equal(isSessionRevoked({}, changed), true);
  assert.equal(isSessionRevoked({ iat: '1' }, changed), true);
});
