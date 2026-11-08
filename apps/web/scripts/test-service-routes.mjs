import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { normalizePhone } from '../src/lib/phone.ts';

const localRequire = createRequire(import.meta.url);
const plain = value => JSON.parse(JSON.stringify(value));
const nextServer = { NextResponse: { json: (body, init = {}) => new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } }) } };

// Nạp một tệp TypeScript của dự án vào vm với các mô-đun giả lập.
function load(path, dependencies) {
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: key => dependencies[key] ?? localRequire(key), Error, RangeError, Response, Buffer, Date, Promise, console: { error: () => {} } }, {});
  return exports;
}

// Giả lập chuỗi truy vấn Supabase: mọi phương thức trả lại chính nó, kết quả lấy từ `results[table]`.
function fakeClient(results, log = []) {
  return {
    from(table) {
      const query = {};
      for (const method of ['select', 'eq', 'order', 'in', 'limit']) query[method] = (...args) => { log.push([table, method, ...args]); return query; };
      query.maybeSingle = async () => results[table];
      query.then = (resolve, reject) => Promise.resolve(results[table]).then(resolve, reject);
      return query;
    },
  };
}

// ── Nội dung công khai: Quảng cáo & Hợp tác, Dịch vụ trọn gói ──
const adCard = { id: 'k1', icon: '📍', icon_bg: 'orange', title: 'Banner KCN', category: 'KCN', tag: 'KCN target', tag_tone: 'ins', description: 'Mô tả', package_lines: ['Dòng 1'], cta_label: 'Đặt', sort_order: 1 };
const pricing = { id: 'p1', format: 'Banner Homepage', placement: 'Trang chủ', price: '1.500.000đ', unit: '30 ngày', cta_label: 'Đặt ngay', sort_order: 1 };
const packageCard = { id: 'g1', icon: '🎯', title: 'RPO', description: 'Mô tả', features: ['A'], price: 'Từ 3.000.000đ', cta_label: 'Tư vấn ngay', accent: 'orange', sort_order: 1 };

function cards(results, log = []) {
  return load('../src/lib/mobile-service-cards.ts', { '@/lib/supabase/server': { createSupabaseServerClient: async () => fakeClient(results, log) } });
}

test('advertising content reads only active rows from the three tables and fails loudly', async () => {
  const log = [];
  const ok = { kcn_ad_cards: { data: [adCard], error: null }, service_partner_cards: { data: [adCard], error: null }, advertising_pricing_cards: { data: [pricing], error: null } };
  const content = await cards(ok, log).getMobileAdvertising();
  assert.equal(content.kcn.length, 1); assert.equal(content.partners.length, 1); assert.equal(content.pricing[0].format, 'Banner Homepage');
  assert.deepEqual([...new Set(log.map(entry => entry[0]))].sort(), ['advertising_pricing_cards', 'kcn_ad_cards', 'service_partner_cards']);
  assert.equal(log.filter(entry => entry[1] === 'eq' && entry[2] === 'is_active' && entry[3] === true).length, 3);
  assert.equal(log.some(entry => entry[1] === 'select' && /is_active|created_at|updated_at/.test(entry[2])), false);
  for (const failing of ['kcn_ad_cards', 'service_partner_cards', 'advertising_pricing_cards']) {
    const results = { ...ok, [failing]: { data: null, error: new Error('boom') } };
    await assert.rejects(() => cards(results).getMobileAdvertising(), /boom/, failing);
  }
  const empty = await cards({ kcn_ad_cards: { data: null, error: null }, service_partner_cards: { data: null, error: null }, advertising_pricing_cards: { data: null, error: null } }).getMobileAdvertising();
  assert.deepEqual(plain(empty), { kcn: [], partners: [], pricing: [] });
});

test('service packages content reads only active cards and fails loudly', async () => {
  const log = [];
  const list = await cards({ service_package_cards: { data: [packageCard], error: null } }, log).getMobileServicePackages();
  assert.equal(list[0].title, 'RPO');
  assert.ok(log.some(entry => entry[0] === 'service_package_cards' && entry[1] === 'eq' && entry[2] === 'is_active' && entry[3] === true));
  await assert.rejects(() => cards({ service_package_cards: { data: null, error: new Error('boom') } }).getMobileServicePackages(), /boom/);
});

for (const [name, path, fn, key, sample] of [
  ['advertising', '../src/app/api/mobile/advertising/route.ts', 'getMobileAdvertising', 'kcn', { kcn: [adCard], partners: [], pricing: [pricing] }],
  ['service-packages', '../src/app/api/mobile/service-packages/route.ts', 'getMobileServicePackages', 'cards', [packageCard]],
]) {
  test(`${name} route is public and cacheable, and sanitizes failures`, async () => {
    const good = load(path, { 'next/server': nextServer, '@/lib/mobile-service-cards': { [fn]: async () => sample } });
    const response = await good.GET();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /s-maxage=60/);
    const body = await response.json();
    assert.equal(body.ok, true); assert.ok(key in body);
    const bad = load(path, { 'next/server': nextServer, '@/lib/mobile-service-cards': { [fn]: async () => { throw new Error('secret db detail'); } } });
    const failed = await bad.GET();
    assert.equal(failed.status, 500);
    assert.equal(failed.headers.get('cache-control'), 'no-store');
    assert.equal(JSON.stringify(await failed.json()).includes('secret db detail'), false);
  });
}

// ── Dịch vụ đã đặt của nhà tuyển dụng ──
const inquiry = { id: 'i1', type: 'Dịch vụ trọn gói', service_name: 'RPO', company_name: 'ABC', phone: '0901234567', phone_normalized: '0901234567', email: 'a@b.vn', request: 'Cần tuyển', kcn_target: null, cancel_reason: null, status: 'new', created_at: '2026-11-02T00:00:00Z', consulted_at: null };

function employerRoute({ session = { employerId: 'e1' }, rows = [inquiry], failure = null } = {}) {
  const seen = [];
  const module = load('../src/app/api/mobile/employer/service-inquiries/route.ts', {
    'next/server': nextServer,
    '@/lib/employer-auth': { getEmployerSession: async () => session },
    '@/lib/employer': { getEmployerServiceInquiries: async id => { seen.push(id); if (failure) throw failure; return rows; } },
  });
  return { module, seen };
}

test('employer service inquiries require a session, are scoped by it and hide the phone key', async () => {
  const anonymous = employerRoute({ session: null });
  const denied = await anonymous.module.GET();
  assert.equal(denied.status, 401); assert.equal(anonymous.seen.length, 0);
  const api = employerRoute();
  const response = await api.module.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(plain(api.seen), ['e1']);
  const body = await response.json();
  assert.equal(body.total, 1); assert.equal(body.items[0].service_name, 'RPO');
  assert.equal('phone_normalized' in body.items[0], false);
  assert.equal(JSON.stringify(body).includes('phone_normalized'), false);
});

test('employer service inquiries cap the list at 100 but report the real total', async () => {
  const rows = Array.from({ length: 130 }, (_, index) => ({ ...inquiry, id: `i${index}` }));
  const body = await (await employerRoute({ rows }).module.GET()).json();
  assert.equal(body.items.length, 100); assert.equal(body.total, 130);
  assert.equal(body.items[0].id, 'i0');
});

test('employer service inquiries sanitize failures', async () => {
  const response = await employerRoute({ failure: new Error('secret db detail') }).module.GET();
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(await response.json()).includes('secret db detail'), false);
});

// ── Dịch vụ đã đặt của 5 loại đối tác ──
function providerHelper({ providerRow = { data: { contact_phone: '0901 234 567' }, error: null }, usersRow = { data: { phone: '+84 901 234 567' }, error: null }, inquiryResult = { data: [inquiry], count: 1, error: null } } = {}) {
  const log = [];
  const helper = load('../src/lib/provider-service-inquiries.ts', {
    'next/server': nextServer,
    '@/lib/phone': { normalizePhone },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => fakeClient({ training_providers: providerRow, rental_providers: providerRow, insurance_providers: providerRow, finance_providers: providerRow, health_providers: providerRow, users: usersRow, service_inquiries: inquiryResult }, log) },
  });
  return { helper, log };
}

test('provider service inquiries match the account phone numbers, de-duplicated and normalized', async () => {
  const api = providerHelper();
  const response = await api.helper.providerServiceInquiriesResponse(async () => ({ userId: 'u1' }), 'training_providers');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = await response.json();
  assert.equal(body.total, 1); assert.equal(body.items.length, 1);
  assert.ok(api.log.some(entry => entry[0] === 'training_providers' && entry[1] === 'eq' && entry[2] === 'user_id' && entry[3] === 'u1'));
  // Không được nhúng users(...) vào truy vấn bảng đối tác (gây lỗi nhiều quan hệ); số trên tài khoản đọc bằng truy vấn riêng.
  const providerSelect = api.log.find(entry => entry[0] === 'training_providers' && entry[1] === 'select');
  assert.equal(providerSelect[2].includes('users'), false);
  assert.ok(api.log.some(entry => entry[0] === 'users' && entry[1] === 'select' && entry[2] === 'phone'));
  assert.ok(api.log.some(entry => entry[0] === 'users' && entry[1] === 'eq' && entry[2] === 'id' && entry[3] === 'u1'));
  const match = api.log.find(entry => entry[0] === 'service_inquiries' && entry[1] === 'in');
  assert.equal(match[2], 'phone_normalized'); assert.deepEqual(plain(match[3]), ['0901234567']);
  assert.ok(api.log.some(entry => entry[0] === 'service_inquiries' && entry[1] === 'limit' && entry[2] === 100));
  const select = api.log.find(entry => entry[0] === 'service_inquiries' && entry[1] === 'select');
  assert.equal(select[2].includes('phone_normalized'), false);
});

test('provider service inquiries use two keys when the account and unit numbers differ', async () => {
  const api = providerHelper({ providerRow: { data: { contact_phone: '0911111111' }, error: null }, usersRow: { data: { phone: '0922222222' }, error: null } });
  await api.helper.providerServiceInquiriesResponse(async () => ({ userId: 'u1' }), 'rental_providers');
  const match = api.log.find(entry => entry[0] === 'service_inquiries' && entry[1] === 'in');
  assert.deepEqual(plain(match[3]).sort(), ['0911111111', '0922222222']);
});

test('provider service inquiries refuse anonymous callers and never query for a missing unit or number', async () => {
  const anonymous = providerHelper();
  const denied = await anonymous.helper.providerServiceInquiriesResponse(async () => null, 'finance_providers');
  assert.equal(denied.status, 401); assert.equal(anonymous.log.length, 0);
  for (const options of [{ providerRow: { data: null, error: null } }, { providerRow: { data: { contact_phone: '' }, error: null }, usersRow: { data: { phone: null }, error: null } }]) {
    const api = providerHelper(options);
    const response = await api.helper.providerServiceInquiriesResponse(async () => ({ userId: 'u1' }), 'health_providers');
    assert.equal(response.status, 200);
    assert.deepEqual(plain(await response.json()), { ok: true, items: [], total: 0 });
    assert.equal(api.log.some(entry => entry[0] === 'service_inquiries'), false);
  }
});

test('provider service inquiries sanitize database failures', async () => {
  for (const options of [{ providerRow: { data: null, error: new Error('secret db detail') } }, { usersRow: { data: null, error: new Error('secret db detail') } }, { inquiryResult: { data: null, count: null, error: new Error('secret db detail') } }]) {
    const response = await providerHelper(options).helper.providerServiceInquiriesResponse(async () => ({ userId: 'u1' }), 'insurance_providers');
    assert.equal(response.status, 500);
    assert.equal(JSON.stringify(await response.json()).includes('secret db detail'), false);
  }
});

test('each provider route passes its own session reader and table to the shared helper', async () => {
  for (const [key, Name] of [['training', 'Training'], ['rental', 'Rental'], ['insurance', 'Insurance'], ['finance', 'Finance'], ['health', 'Health']]) {
    const reader = async () => ({ userId: key });
    const calls = [];
    const route = load(`../src/app/api/mobile/${key}-provider/service-inquiries/route.ts`, {
      [`@/lib/${key}-provider-auth`]: { [`get${Name}ProviderSession`]: reader },
      '@/lib/provider-service-inquiries': { providerServiceInquiriesResponse: (getSession, table) => { calls.push([getSession, table]); return 'ok'; } },
    });
    assert.equal(await route.GET(), 'ok');
    assert.equal(calls[0][0], reader, key); assert.equal(calls[0][1], `${key}_providers`, key);
  }
});
