// Kiểm tra khu Quản trị đối tác trên web: body PATCH phải đúng hình dạng từng route, danh sách trạng thái
// phải khớp route, và lớp gọi api/mobile/admin phải xử lý đúng 401, 409 và "chưa xác định".
//
// Phần đối chiếu đọc thẳng mã nguồn route: route đổi tên trường hay thêm trạng thái mà quên sửa giao diện
// (hoặc ngược lại) thì test này đỏ, thay vì để Admin bấm duyệt rồi nhận lỗi 400 khó hiểu.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  CONTENT_DECISIONS,
  CONTENT_STATUS_LABEL,
  CONTENT_STATUS_TONE,
  contentPatchBody,
  contentProviderOf,
  PARTNER_CONTENTS,
  PARTNER_KINDS,
  PARTNER_PROVIDERS,
  providerPatchBody,
  PROVIDER_TYPE_LABEL,
  providerTypeLabel,
} from '../src/lib/admin-partners.ts';
import * as workerServiceClient from '../src/lib/worker-service-client.ts';

const localRequire = createRequire(import.meta.url);

// `mobile-admin-client.ts` dùng alias `@/lib/...` mà node không tự giải được; nạp qua vm và đưa sẵn
// mô-đun thật vào, giống cách `test-lead-export.mjs` làm.
function load(path, dependencies) {
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    require: (key) => dependencies[key] ?? localRequire(key),
    Error,
    TypeError,
    Response,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    Promise,
    JSON,
    Number,
    Object,
    String,
    Array,
    Boolean,
    console,
  });
  return exports;
}

const { adminList, adminPatch, buildAdminQuery } = load('../src/lib/mobile-admin-client.ts', {
  '@/lib/worker-service-client': workerServiceClient,
});

const here = dirname(fileURLToPath(import.meta.url));
const routeText = (path) =>
  readFileSync(join(here, '..', 'src', 'app', 'api', 'mobile', `${path}`, 'route.ts'), 'utf8');

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Đối tượng tạo trong vm khác nguyên mẫu với đối tượng của test; so sánh qua JSON.
const plain = (value) => JSON.parse(JSON.stringify(value));

// ───────── Cấu hình phải khớp route ─────────

test('mỗi loại đối tác đều có cấu hình đối tác và cấu hình nội dung', () => {
  for (const kind of PARTNER_KINDS) {
    assert.ok(PARTNER_PROVIDERS[kind], `thiếu cấu hình đối tác cho ${kind}`);
    assert.ok(PARTNER_CONTENTS[kind], `thiếu cấu hình nội dung cho ${kind}`);
    assert.equal(PARTNER_PROVIDERS[kind].kind, kind);
    assert.equal(PARTNER_CONTENTS[kind].kind, kind);
  }
});

test('đường dẫn trong cấu hình đều là route có thật', () => {
  for (const kind of PARTNER_KINDS) {
    assert.doesNotThrow(() => routeText(PARTNER_PROVIDERS[kind].path), `không có route ${PARTNER_PROVIDERS[kind].path}`);
    assert.doesNotThrow(() => routeText(PARTNER_CONTENTS[kind].path), `không có route ${PARTNER_CONTENTS[kind].path}`);
    assert.doesNotThrow(() => routeText(`${PARTNER_PROVIDERS[kind].path}/[id]`));
    assert.doesNotThrow(() => routeText(`${PARTNER_CONTENTS[kind].path}/[id]`));
  }
});

test('danh sách trạng thái lọc khớp danh sách route chấp nhận', () => {
  for (const kind of PARTNER_KINDS) {
    const config = PARTNER_CONTENTS[kind];
    const source = routeText(config.path);
    const match = /parseEmployerListParams\([^,]+,\s*\[([^\]]*)\]/.exec(source);
    assert.ok(match, `không đọc được danh sách trạng thái của ${config.path}`);
    const allowed = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual([...config.statuses], allowed, `trạng thái của ${config.path} lệch với route`);
  }
});

test('khu nào route đòi expectedUpdatedAt thì cấu hình phải ghi nhận', () => {
  for (const kind of PARTNER_KINDS) {
    const config = PARTNER_CONTENTS[kind];
    const source = routeText(`${config.path}/[id]`);
    assert.equal(
      source.includes('expectedUpdatedAt'),
      config.needsExpectedUpdatedAt,
      `${config.path} lệch về yêu cầu mốc phiên bản`,
    );
  }
});

test('chỉ Tài chính có duyệt bảng giá, và route đúng là có nhận pricingApproved', () => {
  for (const kind of PARTNER_KINDS) {
    const config = PARTNER_CONTENTS[kind];
    const source = routeText(`${config.path}/[id]`);
    assert.equal(source.includes('pricingApproved'), config.hasPricingApproval, `${config.path} lệch về duyệt bảng giá`);
  }
  assert.equal(PARTNER_CONTENTS.finance.hasPricingApproval, true);
});

test('khu Y tế dùng tên trường isVerified, các khu khác dùng verified', () => {
  // Chỉ xét dòng khai báo schema: thân hàm có thể nhắc isVerified ở chỗ khác (ví dụ ghi nhật ký thao tác).
  const schemaLine = (kind) => {
    const match = /const schema = z\.object\(\{[^\n]*/.exec(routeText(`${PARTNER_PROVIDERS[kind].path}/[id]`));
    assert.ok(match, `không đọc được schema của ${kind}`);
    return match[0];
  };
  assert.match(schemaLine('health'), /isVerified/);
  for (const kind of ['training', 'rental', 'insurance', 'finance']) {
    assert.ok(!schemaLine(kind).includes('isVerified'), `${kind} không dùng isVerified`);
    assert.match(schemaLine(kind), /verified/);
  }
});

test('nhãn và màu có đủ cho mọi trạng thái đang lọc được', () => {
  for (const kind of PARTNER_KINDS) {
    for (const status of PARTNER_CONTENTS[kind].statuses) {
      assert.ok(CONTENT_STATUS_LABEL[status], `thiếu nhãn cho trạng thái ${status}`);
      assert.ok(CONTENT_STATUS_TONE[status], `thiếu màu cho trạng thái ${status}`);
    }
  }
});

test('ba thao tác duyệt đều nằm trong enum status của route', () => {
  for (const kind of PARTNER_KINDS) {
    const source = routeText(`${PARTNER_CONTENTS[kind].path}/[id]`);
    for (const decision of CONTENT_DECISIONS) {
      assert.ok(source.includes(`"${decision}"`), `route ${kind} không nhận trạng thái ${decision}`);
    }
  }
});

test('loại hình đối tác có nhãn tiếng Việt cho mọi mã route nhận', () => {
  // Mã lấy từ chính các route đăng ký đối tác, cộng training_center là mặc định của cơ sở dữ liệu.
  const registered = new Set(['training_center']);
  for (const file of ['training-providers', 'rental-providers', 'insurance-providers', 'finance-providers', 'health-providers']) {
    const source = readFileSync(join(here, '..', 'src', 'app', 'api', file, 'route.ts'), 'utf8');
    const match = /providerType: z\.enum\(\[([^\]]*)\]/.exec(source);
    if (!match) continue;
    for (const value of match[1].matchAll(/"([^"]+)"/g)) registered.add(value[1]);
  }
  for (const code of registered) {
    assert.ok(PROVIDER_TYPE_LABEL[code], `thiếu nhãn tiếng Việt cho loại hình ${code}`);
  }
  assert.equal(providerTypeLabel('clinic'), 'Phòng khám');
  // Mã lạ thì giữ nguyên để không nuốt mất thông tin.
  assert.equal(providerTypeLabel('loai_moi_chua_co_nhan'), 'loai_moi_chua_co_nhan');
  assert.equal(providerTypeLabel(null), null);
  assert.equal(providerTypeLabel('  '), null);
});

// ───────── Dựng body PATCH ─────────

test('đối tác đào tạo và thuê trọ chỉ gửi verified', () => {
  assert.deepEqual(providerPatchBody(PARTNER_PROVIDERS.training, { verified: true }), { verified: true });
  assert.deepEqual(providerPatchBody(PARTNER_PROVIDERS.rental, { verified: false }), { verified: false });
  assert.throws(() => providerPatchBody(PARTNER_PROVIDERS.training, {}), /Thiếu trạng thái xác minh/);
});

test('bảo hiểm và tài chính gửi được riêng xác minh hoặc riêng hạn mức', () => {
  assert.deepEqual(providerPatchBody(PARTNER_PROVIDERS.insurance, { verified: true }), { verified: true });
  assert.deepEqual(providerPatchBody(PARTNER_PROVIDERS.finance, { contactViewLimit: 60 }), { contactViewLimit: 60 });
  assert.deepEqual(providerPatchBody(PARTNER_PROVIDERS.finance, { verified: false, contactViewLimit: 0 }), {
    verified: false,
    contactViewLimit: 0,
  });
  // Route từ chối body rỗng, nên chặn từ giao diện cho rõ lỗi.
  assert.throws(() => providerPatchBody(PARTNER_PROVIDERS.insurance, {}), /Không có thay đổi/);
});

test('y tế phải gửi đủ ba trường, đúng tên isVerified', () => {
  assert.deepEqual(
    providerPatchBody(PARTNER_PROVIDERS.health, {
      verified: true,
      contactViewLimit: 30,
      expectedUpdatedAt: '2026-11-04T02:00:00.000Z',
    }),
    { isVerified: true, contactViewLimit: 30, expectedUpdatedAt: '2026-11-04T02:00:00.000Z' },
  );
  assert.throws(
    () => providerPatchBody(PARTNER_PROVIDERS.health, { verified: true, contactViewLimit: 30 }),
    /Thiếu mốc phiên bản/,
  );
  assert.throws(
    () => providerPatchBody(PARTNER_PROVIDERS.health, { verified: true, expectedUpdatedAt: 'x' }),
    /Thiếu hạn mức/,
  );
});

test('duyệt nội dung: chỉ gửi lý do khi từ chối, và lý do phải đủ dài', () => {
  assert.deepEqual(contentPatchBody(PARTNER_CONTENTS.training, { status: 'approved' }), { status: 'approved' });
  assert.deepEqual(contentPatchBody(PARTNER_CONTENTS.training, { status: 'hidden' }), { status: 'hidden' });
  assert.deepEqual(contentPatchBody(PARTNER_CONTENTS.training, { status: 'rejected', rejectionReason: '  Sai nội dung  ' }), {
    status: 'rejected',
    rejectionReason: 'Sai nội dung',
  });
  assert.throws(() => contentPatchBody(PARTNER_CONTENTS.training, { status: 'rejected', rejectionReason: 'x' }), /lý do/);
  assert.throws(() => contentPatchBody(PARTNER_CONTENTS.insurance, { status: 'rejected' }), /lý do/);
});

test('tài chính và y tế bắt buộc kèm mốc phiên bản', () => {
  assert.deepEqual(
    contentPatchBody(PARTNER_CONTENTS.health, { status: 'approved', expectedUpdatedAt: '2026-11-04T02:00:00.000Z' }),
    { status: 'approved', expectedUpdatedAt: '2026-11-04T02:00:00.000Z' },
  );
  assert.throws(() => contentPatchBody(PARTNER_CONTENTS.finance, { status: 'approved' }), /Thiếu mốc phiên bản/);
  // Khu không cần thì không gửi thừa, tránh route từ chối vì trường lạ.
  assert.deepEqual(
    contentPatchBody(PARTNER_CONTENTS.training, { status: 'approved', expectedUpdatedAt: '2026-11-04T02:00:00.000Z' }),
    { status: 'approved' },
  );
});

test('duyệt bảng giá chỉ gửi ở Tài chính và chỉ khi duyệt', () => {
  assert.deepEqual(
    contentPatchBody(PARTNER_CONTENTS.finance, { status: 'approved', expectedUpdatedAt: 'v1', pricingApproved: true }),
    { status: 'approved', expectedUpdatedAt: 'v1', pricingApproved: true },
  );
  assert.deepEqual(
    contentPatchBody(PARTNER_CONTENTS.insurance, { status: 'approved', pricingApproved: true }),
    { status: 'approved' },
  );
});

test('đọc tên đối tác dù route trả phẳng hay lồng', () => {
  assert.deepEqual(contentProviderOf(PARTNER_CONTENTS.training, { provider_name: 'Trung tâm A', provider_verified: true }), {
    name: 'Trung tâm A',
    verified: true,
  });
  assert.deepEqual(
    contentProviderOf(PARTNER_CONTENTS.insurance, { provider: { provider_name: 'Manulife', is_verified: false } }),
    { name: 'Manulife', verified: false },
  );
  assert.deepEqual(contentProviderOf(PARTNER_CONTENTS.health, {}), { name: null, verified: false });
});

// ───────── Lớp gọi api/mobile/admin ─────────

test('query bỏ tham số rỗng', () => {
  assert.equal(buildAdminQuery({ q: '', status: 'pending', page: 1 }), '?status=pending&page=1');
  assert.equal(buildAdminQuery({ q: '', status: '' }), '');
});

test('danh sách tự suy ra hasMore khi route không trả (ví dụ báo lỗi)', async () => {
  const result = await adminList('admin/bug-reports', { status: '', page: 1, pageSize: 20 }, {
    fetchImpl: async (url) => {
      assert.equal(url, '/api/mobile/admin/bug-reports?page=1&pageSize=20');
      return json({ ok: true, items: [{ id: 'a' }], total: 45, newCount: 7, page: 1, pageSize: 20 });
    },
  });
  assert.equal(result.hasMore, true);
  assert.equal(result.total, 45);
  // Số liệu phụ của route được giữ lại cho giao diện dùng.
  assert.deepEqual(plain(result.extra), { newCount: 7 });
});

test('danh sách tin vào hasMore do route trả', async () => {
  const result = await adminList('admin/marketplace', { page: 2, pageSize: 20 }, {
    fetchImpl: async () => json({ ok: true, items: [], total: 100, page: 2, pageSize: 20, hasMore: false }),
  });
  assert.equal(result.hasMore, false);
});

test('phản hồi sai trang bị từ chối', async () => {
  await assert.rejects(
    adminList('admin/training-providers', { page: 2, pageSize: 20 }, {
      fetchImpl: async () => json({ ok: true, items: [], total: 0, page: 1, pageSize: 20 }),
    }),
    (error) => error.code === 'RESPONSE',
  );
});

test('hết phiên Admin nói rõ phải đăng nhập lại, không báo là lỗi mạng', async () => {
  await assert.rejects(
    adminList('admin/marketplace', { page: 1, pageSize: 20 }, {
      fetchImpl: async () => json({ error: 'Vui lòng đăng nhập Admin.' }, 401),
    }),
    (error) => error.status === 401 && /đăng nhập lại/.test(error.message),
  );
});

test('thiếu quyền giữ nguyên thông báo của máy chủ', async () => {
  await assert.rejects(
    adminList('admin/finance-providers', { page: 1, pageSize: 20 }, {
      fetchImpl: async () => json({ error: 'Chức năng này cần quyền Superadmin.' }, 403),
    }),
    (error) => error.status === 403 && error.message === 'Chức năng này cần quyền Superadmin.',
  );
});

test('ghi thành công trả về nội dung phản hồi', async () => {
  const result = await adminPatch('admin/training-providers/abc', { verified: true }, {
    fetchImpl: async (url, init) => {
      assert.equal(init.method, 'PATCH');
      assert.equal(url, '/api/mobile/admin/training-providers/abc');
      return json({ ok: true, provider: { id: 'abc', is_verified: true } });
    },
  });
  assert.equal(result.ok, true);
});

test('409 do người khác vừa sửa thì hiện đúng lời nhắc tải lại, KHÔNG phải chưa xác định', async () => {
  await assert.rejects(
    adminPatch('admin/finance-products/abc', {}, {
      fetchImpl: async () => json({ error: 'Nội dung sản phẩm đã thay đổi. Tải lại danh sách để kiểm tra phiên bản mới.' }, 409),
    }),
    (error) => error.status === 409 && error.code === 'HTTP' && error.uncertain === false,
  );
});

test('mất mạng hoặc 5xx khi ghi là CHƯA XÁC ĐỊNH', async () => {
  await assert.rejects(
    adminPatch('admin/marketplace/abc', {}, {
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    }),
    (error) => error.code === 'UNCERTAIN' && /Tải lại danh sách/.test(error.message),
  );
  await assert.rejects(
    adminPatch('admin/marketplace/abc', {}, { fetchImpl: async () => json({ error: 'x' }, 503) }),
    (error) => error.code === 'UNCERTAIN',
  );
});

test('phản hồi 2xx nhưng không có ok:true cũng là chưa xác định', async () => {
  await assert.rejects(
    adminPatch('admin/bug-reports/abc', {}, { fetchImpl: async () => json({ report: {} }, 200) }),
    (error) => error.code === 'UNCERTAIN',
  );
});
