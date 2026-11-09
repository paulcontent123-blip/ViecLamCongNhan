import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

// Kiểm tra lớp xử lý yêu cầu xóa tài khoản dùng chung (nhà tuyển dụng và 5 loại đối tác): userId chỉ lấy từ phiên,
// không tạo yêu cầu trùng, rút lại chỉ tác động yêu cầu đang chờ của chính mình, lỗi database không lộ chi tiết.

const localRequire = createRequire(import.meta.url);
const nextServer = { NextResponse: { json: (body, init = {}) => new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } }) } };

function load(path, dependencies) {
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: key => dependencies[key] ?? localRequire(key), Error, Response, Promise, Date, String, console: { error: () => {} } }, {});
  return exports;
}

// Chuỗi truy vấn giả: ghi lại mọi lời gọi; mỗi lần await/single/maybeSingle lấy kết quả kế tiếp trong `queue`.
function fakeDb(queue, log) {
  return {
    from(table) {
      const q = {};
      for (const method of ['select', 'insert', 'update', 'eq', 'in', 'order', 'limit']) q[method] = (...args) => { log.push([table, method, ...args]); return q; };
      const next = async () => queue.shift() ?? { data: null, error: null };
      q.single = next; q.maybeSingle = next;
      q.then = (resolve, reject) => next().then(resolve, reject);
      return q;
    },
  };
}

function handlers({ session = { userId: 'u1' }, queue = [] } = {}) {
  const log = [];
  const mod = load('../src/lib/account-deletion-request.ts', {
    'server-only': {}, 'next/server': nextServer,
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => fakeDb(queue, log) },
    '@/lib/supabase/safe-error-log': { logSafeSupabaseError: () => 'req-1' },
  });
  return { h: mod.accountDeletionRequestRoute(async () => session, '/test'), log };
}
const post = body => ({ json: async () => body });

test('anonymous callers are refused on every method without touching the database', async () => {
  const log = [];
  const mod = load('../src/lib/account-deletion-request.ts', { 'server-only': {}, 'next/server': nextServer, '@/lib/supabase/admin': { createSupabaseAdminClient: () => fakeDb([], log) }, '@/lib/supabase/safe-error-log': { logSafeSupabaseError: () => 'x' } });
  const h = mod.accountDeletionRequestRoute(async () => null, '/test');
  for (const call of [() => h.GET(), () => h.POST(post({})), () => h.DELETE()]) assert.equal((await call()).status, 401);
  assert.equal(log.length, 0);
});

test('POST creates a request for the session user only and ignores any user id in the body', async () => {
  const created = { id: 'r1', status: 'pending', reason: 'Không dùng nữa', requested_at: 'now', handled_at: null, admin_note: null };
  const { h, log } = handlers({ queue: [{ data: null, error: null }, { data: created, error: null }] });
  const response = await h.POST(post({ reason: ' Không dùng nữa ', user_id: 'attacker', userId: 'attacker' }));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).request.id, 'r1');
  const insert = log.find(entry => entry[1] === 'insert');
  assert.deepEqual(JSON.parse(JSON.stringify(insert[2])), { user_id: 'u1', reason: 'Không dùng nữa' });
});

test('POST returns the existing pending request instead of creating a duplicate', async () => {
  const pending = { id: 'r0', status: 'pending' };
  const { h, log } = handlers({ queue: [{ data: pending, error: null }] });
  const response = await h.POST(post({}));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).request.id, 'r0');
  assert.equal(log.some(entry => entry[1] === 'insert'), false);
});

test('POST rejects a reason longer than 500 characters', async () => {
  const { h } = handlers();
  assert.equal((await h.POST(post({ reason: 'x'.repeat(501) }))).status, 400);
});

test('DELETE only cancels the pending request of the session user', async () => {
  const { h, log } = handlers({ queue: [{ error: null }] });
  const response = await h.DELETE();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, request: null });
  assert.ok(log.some(entry => entry[1] === 'eq' && entry[2] === 'user_id' && entry[3] === 'u1'));
  assert.ok(log.some(entry => entry[1] === 'eq' && entry[2] === 'status' && entry[3] === 'pending'));
});

test('database failures return a generic message and a request id', async () => {
  const { h } = handlers({ queue: [{ data: null, error: new Error('secret db detail') }] });
  const response = await h.GET();
  assert.equal(response.status, 503);
  const text = JSON.stringify(await response.json());
  assert.equal(text.includes('secret db detail'), false);
  assert.ok(text.includes('req-1'));
});
