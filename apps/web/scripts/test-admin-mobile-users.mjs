import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as accounts from '../src/lib/mobile-admin-users.ts';
import { parseEmployerListParams } from '../src/lib/mobile-employer-list-params.ts';

const id = '11111111-1111-4111-8111-111111111111';
const user = { id, full_name: 'Tài khoản thử', email: null, phone: '0901234567', role: 'training_provider', admin_role: null, status: 'active', is_verified: false, created_at: '2026-11-02T00:00:00Z' };
const localRequire = createRequire(import.meta.url);

function route(detail, { allowed = true, unauthenticated = false, result = { data: [user], count: 1, error: null } } = {}) {
  let reads = 0;
  const calls = [];
  const query = {};
  for (const method of ['select', 'eq', 'order', 'or']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  query.range = async (...args) => { calls.push(['range', ...args]); return result; };
  query.maybeSingle = async () => result;
  const dependencies = {
    'next/server': { NextResponse: { json: (body, init = {}) => new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } }) } },
    '@/lib/admin-auth': { requireAdmin: async capability => {
      assert.equal(capability, 'admin_users');
      return allowed ? { session: { adminRole: 'superadmin' } } : { error: new Response('{}', { status: unauthenticated ? 401 : 403 }) };
    } },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => { reads++; return { from: table => { assert.equal(table, 'users'); return query; } }; } },
    '@/lib/supabase/safe-error-log': { logSafeSupabaseError: () => 'safe-request-id' },
    '@/lib/mobile-admin-users': accounts,
    '@/lib/mobile-employer-list-params': { parseEmployerListParams },
  };
  const file = new URL(`../src/app/api/mobile/admin/users/${detail ? '[id]/' : ''}route.ts`, import.meta.url);
  const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: key => dependencies[key] ?? localRequire(key), Error, RangeError, Response });
  return { get: (queryString = '', accountId = id) => exports.GET({ nextUrl: new URL(`https://example.com/api/mobile/admin/users?${queryString}`) }, { params: Promise.resolve({ id: accountId }) }), reads: () => reads, calls };
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
