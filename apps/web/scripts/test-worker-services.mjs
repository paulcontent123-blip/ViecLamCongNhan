// Kiểm tra khu "Dịch vụ công nhân" trên web: định dạng hiển thị, lớp gọi api/mobile (nhất là quy tắc
// "chưa xác định" khi ghi), và các BẢN SAO HẰNG SỐ không được lệch khỏi máy chủ.
//
// Phần đối chiếu với máy chủ đọc thẳng mã nguồn route: nếu ai đó thêm một nhóm sản phẩm hay một chủ đề
// tư vấn ở route mà quên thêm vào giao diện (hoặc ngược lại), test này sẽ đỏ.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  CONTACT_CONSENT_TEXT,
  displayProvince,
  FINANCE_PUBLIC_CATEGORIES,
  FINANCE_TOPICS,
  financeTopicsFor,
  formatArea,
  formatCalendarDate,
  formatRent,
  formatTuition,
  HEALTH_CATEGORIES,
  INSURANCE_CATEGORIES,
  SHARE_CONSENT_VERSION,
  splitLines,
  todayInVietnam,
  WORKER_SERVICE_KEYS,
  WORKER_SERVICE_LIST,
  WORKER_SERVICES,
} from '../src/lib/worker-services.ts';
import {
  buildListQuery,
  directId,
  fetchDetail,
  fetchList,
  nestedId,
  submitInquiry,
  WorkerServiceError,
} from '../src/lib/worker-service-client.ts';
import { ROUTES } from '../src/lib/routes.ts';
import { provinceName } from '../src/lib/provinces.ts';

const here = dirname(fileURLToPath(import.meta.url));
const routeSource = (path) => readFileSync(join(here, '..', 'src', 'app', 'api', 'mobile', path, 'route.ts'), 'utf8');

/** Lấy danh sách chuỗi trong `const categories = [...] as const;` của một route. */
function serverCategories(path) {
  const match = /const categories = \[([^\]]*)\] as const;/.exec(routeSource(path));
  assert.ok(match, `Không tìm thấy danh sách categories trong route ${path}`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// ───────── Định dạng hiển thị ─────────

test('học phí: 0 là miễn phí, số lạ thì mời liên hệ', () => {
  assert.equal(formatTuition(0), 'Miễn phí');
  assert.equal(formatTuition(2500000), '2.500.000đ');
  assert.equal(formatTuition(null), 'Liên hệ đơn vị đào tạo');
  assert.equal(formatTuition(1.5), 'Liên hệ đơn vị đào tạo');
  assert.equal(formatTuition('2000000'), 'Liên hệ đơn vị đào tạo');
});

test('giá thuê: thiếu số thì không hiện 0đ', () => {
  assert.equal(formatRent(1800000), '1.800.000đ/tháng');
  assert.equal(formatRent(0), 'Thỏa thuận');
  assert.equal(formatRent(null), 'Liên hệ chủ trọ');
  assert.equal(formatRent(undefined), 'Liên hệ chủ trọ');
});

test('diện tích: bỏ số 0 thập phân, giá trị vô nghĩa thì ẩn', () => {
  assert.equal(formatArea(18), '18 m²');
  assert.equal(formatArea(18.5), '18,5 m²');
  assert.equal(formatArea(0), null);
  assert.equal(formatArea(null), null);
});

test('ngày theo lịch giữ nguyên ngày, không lệch vì múi giờ', () => {
  // Lỗi hay gặp: new Date("2026-11-04") là 0h UTC, máy ở múi giờ âm sẽ hiện 3/11.
  assert.equal(formatCalendarDate('2026-11-04'), '4/11/2026');
  assert.equal(formatCalendarDate('2026-01-09'), '9/1/2026');
  assert.equal(formatCalendarDate(''), null);
  assert.equal(formatCalendarDate(null), null);
  assert.equal(formatCalendarDate('tháng 11'), 'tháng 11');
});

test('hôm nay theo giờ Việt Nam, không theo múi giờ máy chạy', () => {
  // 22:30 UTC ngày 3/11 đã là 5:30 sáng ngày 4/11 ở Việt Nam.
  assert.equal(todayInVietnam(new Date('2026-11-03T22:30:00Z')), '2026-11-04');
  assert.equal(todayInVietnam(new Date('2026-11-04T09:00:00Z')), '2026-11-04');
  assert.match(todayInVietnam(), /^\d{4}-\d{2}-\d{2}$/);
});

test('tỉnh/thành: mã đúng ra tên, chữ tự do giữ nguyên, số vô nghĩa thì ẩn', () => {
  // Máy chủ nhận provinceCode là chuỗi tự do nên dữ liệu thật có cả ba dạng này.
  assert.equal(displayProvince('HCM', provinceName), 'TP. Hồ Chí Minh');
  assert.equal(displayProvince('Tp.HCM', provinceName), 'Tp.HCM');
  assert.equal(displayProvince('00700', provinceName), null);
  assert.equal(displayProvince('  ', provinceName), null);
  assert.equal(displayProvince(null, provinceName), null);
});

test('tóm tắt nhiều dòng tách thành danh sách, bỏ dấu đầu dòng', () => {
  assert.deepEqual(splitLines('- Khám định kỳ\n• Thuốc cơ bản\n\n  '), ['Khám định kỳ', 'Thuốc cơ bản']);
  assert.deepEqual(splitLines(null), []);
});

// ───────── Bản sao hằng số phải khớp máy chủ ─────────

test('phiên bản câu đồng ý chia sẻ khớp phiên bản máy chủ ghi vào bản ghi', () => {
  // Đọc từ mã nguồn thay vì import: `lead-export.ts` dùng alias `@/lib/...` mà node không tự giải được.
  const source = readFileSync(join(here, '..', 'src', 'lib', 'lead-export.ts'), 'utf8');
  const match = /LEAD_SHARE_CONSENT_VERSION = "([^"]+)"/.exec(source);
  assert.ok(match, 'Không tìm thấy LEAD_SHARE_CONSENT_VERSION trong lead-export.ts');
  assert.equal(SHARE_CONSENT_VERSION, match[1]);
});

test('nhóm sản phẩm bảo hiểm khớp enum của route', () => {
  assert.deepEqual([...INSURANCE_CATEGORIES], serverCategories('insurance/products'));
});

test('nhóm sản phẩm tài chính khớp enum của route', () => {
  assert.deepEqual([...FINANCE_PUBLIC_CATEGORIES], serverCategories('finance/products'));
});

test('loại dịch vụ y tế khớp enum của route', () => {
  assert.deepEqual([...HEALTH_CATEGORIES], serverCategories('health/services'));
});

test('chủ đề tư vấn tài chính khớp bảng TOPICS của route (route trả 400 nếu lệch)', () => {
  const source = routeSource('finance/inquiries');
  const block = /const TOPICS: Record<string, string\[\]> = \{([\s\S]*?)\n\};/.exec(source);
  assert.ok(block, 'Không tìm thấy bảng TOPICS trong route finance/inquiries');

  const serverTopics = {};
  for (const line of block[1].split('\n')) {
    const entry = /^\s*(\w+):\s*\[([^\]]*)\]/.exec(line);
    if (!entry) continue;
    serverTopics[entry[1]] = [...entry[2].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  }

  assert.deepEqual(Object.keys(serverTopics).sort(), Object.keys(FINANCE_TOPICS).sort());
  for (const [category, topics] of Object.entries(serverTopics)) {
    assert.deepEqual(
      FINANCE_TOPICS[category].map((topic) => topic.value),
      topics,
      `Chủ đề của nhóm ${category} lệch với route`,
    );
  }
});

test('nhóm sản phẩm lạ vẫn có chủ đề để chọn, không làm hỏng form', () => {
  assert.equal(financeTopicsFor('nhom_moi_chua_biet'), FINANCE_TOPICS.ewa);
  assert.equal(financeTopicsFor(null), FINANCE_TOPICS.ewa);
  assert.equal(financeTopicsFor('remittance'), FINANCE_TOPICS.remittance);
});

test('đường dẫn trong metadata khớp ROUTES và trang thực tế', () => {
  assert.deepEqual(WORKER_SERVICE_LIST.map((item) => item.key), [...WORKER_SERVICE_KEYS]);
  assert.equal(WORKER_SERVICES['hoc-nghe'].href, ROUTES.hocNghe);
  assert.equal(WORKER_SERVICES['thue-tro'].href, ROUTES.thueTro);
  assert.equal(WORKER_SERVICES['bao-hiem'].href, ROUTES.baoHiem);
  assert.equal(WORKER_SERVICES['tai-chinh'].href, ROUTES.taiChinh);
  assert.equal(WORKER_SERVICES['y-te'].href, ROUTES.yTe);
  for (const item of WORKER_SERVICE_LIST) {
    assert.ok(item.href.startsWith(`${ROUTES.dichVuCongNhan}/`), `${item.key} phải nằm trong khu dịch vụ công nhân`);
  }
});

test('mỗi khu cần đồng ý liên hệ đều có câu đồng ý riêng', () => {
  // Học nghề không có ô đồng ý bắt buộc (route không nhận contactConsent), nên không có trong bảng này.
  assert.deepEqual(Object.keys(CONTACT_CONSENT_TEXT).sort(), ['bao-hiem', 'tai-chinh', 'thue-tro', 'y-te']);
  for (const text of Object.values(CONTACT_CONSENT_TEXT)) assert.ok(text.length > 30);
});

// ───────── Lớp gọi api/mobile: đọc danh sách ─────────

test('query bỏ tham số rỗng, giữ tham số có giá trị', () => {
  assert.equal(buildListQuery({ page: 1, pageSize: 20, q: '', province: 'HCM', minRent: undefined }), '?page=1&pageSize=20&province=HCM');
  assert.equal(buildListQuery({ q: '', province: '' }), '');
  assert.equal(buildListQuery({ maxRent: 0 }), '?maxRent=0');
});

test('đọc danh sách trả về đúng items và tham số phân trang đã gửi', async () => {
  let seen = '';
  const result = await fetchList(
    'rentals',
    { province: 'HCM', page: 2, pageSize: 10 },
    {
      fetchImpl: async (url) => {
        seen = url;
        return json({ ok: true, items: [{ id: 'a' }], total: 11, page: 2, pageSize: 10, hasMore: false });
      },
    },
  );
  assert.equal(seen, '/api/mobile/rentals?province=HCM&page=2&pageSize=10');
  assert.deepEqual(result.items, [{ id: 'a' }]);
  assert.equal(result.total, 11);
  assert.equal(result.hasMore, false);
});

test('phản hồi trả sai trang thì báo lỗi, không hiện dữ liệu của trang khác', async () => {
  await assert.rejects(
    fetchList('rentals', { page: 2, pageSize: 10 }, {
      fetchImpl: async () => json({ ok: true, items: [], total: 0, page: 1, pageSize: 10, hasMore: false }),
    }),
    (error) => error instanceof WorkerServiceError && error.code === 'RESPONSE',
  );
});

test('danh sách thiếu trường bắt buộc cũng bị coi là phản hồi lạ', async () => {
  await assert.rejects(
    fetchList('health/services', { page: 1, pageSize: 20 }, {
      fetchImpl: async () => json({ ok: true, items: [], total: 0, page: 1, pageSize: 20 }),
    }),
    (error) => error.code === 'RESPONSE',
  );
});

test('lỗi HTTP khi đọc danh sách dùng đúng thông báo của máy chủ', async () => {
  await assert.rejects(
    fetchList('rentals', { page: 1, pageSize: 20 }, {
      fetchImpl: async () => json({ error: 'Khoảng giá thuê không hợp lệ.' }, 400),
    }),
    (error) => error.status === 400 && error.message === 'Khoảng giá thuê không hợp lệ.',
  );
});

test('mất mạng khi đọc danh sách báo lỗi mạng, không phải lỗi dữ liệu', async () => {
  await assert.rejects(
    fetchList('rentals', { page: 1, pageSize: 20 }, {
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    }),
    (error) => error.code === 'NETWORK',
  );
});

test('chi tiết trả về bản ghi khác id đã mở thì bị từ chối', async () => {
  const ok = await fetchDetail('rentals/abc', 'listing', 'abc', {
    fetchImpl: async () => json({ ok: true, listing: { id: 'abc', title: 'Phòng 1' } }),
  });
  assert.equal(ok.title, 'Phòng 1');

  await assert.rejects(
    fetchDetail('rentals/abc', 'listing', 'abc', {
      fetchImpl: async () => json({ ok: true, listing: { id: 'xyz' } }),
    }),
    (error) => error.code === 'RESPONSE',
  );
});

test('chi tiết 404 giữ nguyên status để giao diện nói "không còn công khai"', async () => {
  await assert.rejects(
    fetchDetail('vocational/courses/x', 'course', 'x', {
      fetchImpl: async () => json({ error: 'Không tìm thấy khóa học.' }, 404),
    }),
    (error) => error.status === 404 && error.code === 'HTTP',
  );
});

// ───────── Lớp gọi api/mobile: gửi yêu cầu (quy tắc "chưa xác định") ─────────

const uncertainMessage = 'Chưa xác định yêu cầu đã gửi hay chưa. Kiểm tra lại trước khi gửi lần nữa.';

test('gửi thành công trả về mã yêu cầu', async () => {
  const id = await submitInquiry('rentals/inquiries', { listingId: 'a' }, (data) => nestedId(data, 'inquiry'), {
    fetchImpl: async (url, init) => {
      assert.equal(init.method, 'POST');
      assert.equal(url, '/api/mobile/rentals/inquiries');
      return json({ ok: true, inquiry: { id: 'inq-1', status: 'new' } }, 201);
    },
  });
  assert.equal(id, 'inq-1');
});

test('mã yêu cầu nằm thẳng trong phản hồi cũng đọc được', async () => {
  const id = await submitInquiry('vocational/inquiries', {}, (data) => directId(data, 'inquiryId'), {
    fetchImpl: async () => json({ ok: true, inquiryId: 'voc-1' }, 201),
  });
  assert.equal(id, 'voc-1');
});

test('mất mạng khi gửi là CHƯA XÁC ĐỊNH, không được coi là thất bại để gửi lại', async () => {
  await assert.rejects(
    submitInquiry('health/inquiries', {}, (data) => nestedId(data, 'inquiry'), {
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    }),
    (error) => error.code === 'UNCERTAIN' && error.uncertain === true && error.message === uncertainMessage,
  );
});

test('máy chủ lỗi 5xx khi gửi cũng là CHƯA XÁC ĐỊNH (có thể đã ghi rồi mới lỗi)', async () => {
  for (const status of [500, 502, 503]) {
    await assert.rejects(
      submitInquiry('insurance/inquiries', {}, (data) => nestedId(data, 'inquiry'), {
        fetchImpl: async () => json({ error: 'Chưa gửi được yêu cầu tư vấn.' }, status),
      }),
      (error) => error.code === 'UNCERTAIN' && error.status === status,
    );
  }
});

test('phản hồi 2xx nhưng thiếu mã yêu cầu cũng là CHƯA XÁC ĐỊNH', async () => {
  await assert.rejects(
    submitInquiry('finance/inquiries', {}, (data) => nestedId(data, 'inquiry'), {
      fetchImpl: async () => json({ ok: true }, 201),
    }),
    (error) => error.code === 'UNCERTAIN',
  );
  await assert.rejects(
    submitInquiry('finance/inquiries', {}, (data) => nestedId(data, 'inquiry'), {
      fetchImpl: async () => json({ ok: false, inquiry: { id: 'x' } }, 200),
    }),
    (error) => error.code === 'UNCERTAIN',
  );
});

test('lỗi 4xx hiện đúng thông báo máy chủ và CHO phép sửa rồi gửi lại', async () => {
  await assert.rejects(
    submitInquiry('vocational/applications', {}, (data) => directId(data, 'applicationId'), {
      fetchImpl: async () => json({ error: 'Số điện thoại này đã gửi hồ sơ cho khóa học.' }, 409),
    }),
    (error) =>
      error.code === 'HTTP' &&
      error.uncertain === false &&
      error.status === 409 &&
      error.message === 'Số điện thoại này đã gửi hồ sơ cho khóa học.',
  );
});

test('phản hồi không đọc được JSON thì không bao giờ báo gửi thành công', async () => {
  await assert.rejects(
    submitInquiry('health/inquiries', {}, (data) => nestedId(data, 'inquiry'), {
      fetchImpl: async () => new Response('<html>502 Bad Gateway</html>', { status: 502 }),
    }),
    (error) => error.code === 'UNCERTAIN',
  );
});
