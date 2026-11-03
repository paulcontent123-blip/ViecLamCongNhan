import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as ads from '../src/lib/ads.ts';

const K1 = '11111111-1111-4111-8111-111111111111';
const K2 = '22222222-2222-4222-8222-222222222222';
const K3 = '33333333-3333-4333-8333-333333333333';
const kcns = n => ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, n).map((_, index) => `${index}0000000-0000-4000-8000-000000000000`);
const base = { title: 'Banner tháng 11', imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/ads/a.jpg', startsOn: '2026-11-01', endsOn: '2026-11-30' };
const parse = value => ads.adCreateSchema.safeParse(value);
const errorOf = value => { const result = parse(value); return result.success ? null : result.error.issues[0].message; };

// ── Quy tắc theo vị trí ──
test('each placement accepts its valid shape and applies defaults', () => {
  assert.equal(parse({ ...base, placement: 'homepage_banner' }).success, true);
  assert.equal(parse({ ...base, placement: 'sidebar', showOnApp: false }).success, true);
  assert.equal(parse({ ...base, placement: 'kcn_banner', kcnIds: [K1] }).success, true);
  assert.equal(parse({ ...base, placement: 'kcn_banner', kcnIds: kcns(5) }).success, true, 'Bundle 5 KCN');
  assert.equal(parse({ title: 'Nhà trọ Sao Mai', placement: 'service_card', kcnIds: [K1], startsOn: '2026-11-01', endsOn: '2026-11-30', isHot: true }).success, true, 'card chỉ có chữ');
  const parsed = parse({ ...base, placement: 'homepage_banner' }).data;
  assert.deepEqual([parsed.showOnWeb, parsed.showOnApp, parsed.status, parsed.isHot, parsed.kcnIds], [true, true, 'active', false, []]);
});

test('invalid combinations are rejected with a clear message', () => {
  assert.match(errorOf({ ...base, placement: 'sidebar' }), /Sidebar chỉ hiển thị trên web/, 'sidebar mặc định bật cả app');
  assert.match(errorOf({ ...base, placement: 'sidebar', showOnApp: false, showOnWeb: false }), /ít nhất một nơi|Sidebar chỉ/);
  assert.match(errorOf({ ...base, placement: 'homepage_banner', kcnIds: [K1] }), /toàn site/);
  assert.match(errorOf({ ...base, placement: 'kcn_banner', kcnIds: [] }), /từ 1 đến 5 KCN/);
  assert.match(errorOf({ ...base, placement: 'kcn_banner', kcnIds: kcns(6) }), /Tối đa 5/);
  assert.match(errorOf({ ...base, placement: 'kcn_banner', kcnIds: [K1, K1] }), /trùng/);
  assert.match(errorOf({ title: 'Nhà trọ', placement: 'service_card', kcnIds: [K1, K2], startsOn: base.startsOn, endsOn: base.endsOn }), /đúng 1 KCN/);
  assert.match(errorOf({ ...base, placement: 'kcn_banner', kcnIds: [K1], isHot: true }), /HOT chỉ dùng cho card/);
  assert.match(errorOf({ title: 'Banner', placement: 'homepage_banner', startsOn: base.startsOn, endsOn: base.endsOn }), /cần ảnh/);
  assert.match(errorOf({ ...base, placement: 'homepage_banner', endsOn: '2026-10-31' }), /Ngày kết thúc/);
  assert.match(errorOf({ ...base, placement: 'homepage_banner', startsOn: '2026-02-30' }), /không hợp lệ/);
  assert.match(errorOf({ ...base, placement: 'homepage_banner', showOnWeb: false, showOnApp: false }), /ít nhất một nơi/);
  assert.match(errorOf({ ...base, placement: 'homepage_banner', title: 'ab' }), /tối thiểu 3/);
  assert.notEqual(errorOf({ ...base, placement: 'homepage_banner', extra: 1 }), null, 'trường lạ bị từ chối');
});

test('links must be https (images) or https/tel (links); javascript and http are refused', () => {
  for (const imageUrl of ['http://x.com/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'https://evil.com/ads/a.jpg', 'https://res.cloudinary.com/demo/image/upload/v1/article-covers/a.jpg', 'https://res.cloudinary.com/demo/image/upload/c_scale,w_10/v1/ads/a.jpg']) {
    assert.match(errorOf({ ...base, placement: 'homepage_banner', imageUrl }), /tải lên bằng nút chọn ảnh/, imageUrl);
  }
  for (const linkUrl of ['http://x.com', 'javascript:alert(1)', 'tel:abc', 'zalo.me/123']) {
    assert.match(errorOf({ ...base, placement: 'homepage_banner', linkUrl }), /https:\/\/ hoặc tel:/, linkUrl);
  }
  assert.equal(parse({ ...base, placement: 'homepage_banner', linkUrl: 'https://zalo.me/123' }).success, true);
  assert.equal(parse({ ...base, placement: 'homepage_banner', linkUrl: 'tel:+84901234567' }).success, true);
  assert.equal(parse({ ...base, placement: 'homepage_banner', linkUrl: '' }).data.linkUrl, null);
});

// ── Chống trùng chỗ ──
const slot = (over = {}) => ({ id: 'a', placement: 'kcn_banner', kcn_ids: [K1], show_on_web: true, show_on_app: true, starts_on: '2026-11-01', ends_on: '2026-11-30', status: 'active', ...over });

test('single-slot placements refuse overlapping ads in the same channel, KCN and dates', () => {
  const existing = [slot()];
  assert.ok(ads.findSlotConflict(slot({ id: 'b' }), existing), 'cùng KCN, cùng ngày');
  assert.ok(ads.findSlotConflict(slot({ id: 'b', kcn_ids: [K2, K1] }), existing), 'Bundle có chung 1 KCN');
  assert.equal(ads.findSlotConflict(slot({ id: 'b', kcn_ids: [K2] }), existing), null, 'KCN khác thì không trùng');
  assert.equal(ads.findSlotConflict(slot({ id: 'b', starts_on: '2026-12-01', ends_on: '2026-12-31' }), existing), null, 'liền kề sau không trùng');
  assert.ok(ads.findSlotConflict(slot({ id: 'b', starts_on: '2026-11-30', ends_on: '2026-12-31' }), existing), 'trùng đúng 1 ngày cuối');
  assert.equal(ads.findSlotConflict(slot({ id: 'b', show_on_app: false }), [slot({ show_on_web: false })]), null, 'web và app tách nhau');
  assert.ok(ads.findSlotConflict(slot({ id: 'b', show_on_app: false }), existing), 'cùng kênh web');
  assert.equal(ads.findSlotConflict(slot({ id: 'b' }), [slot({ status: 'paused' })]), null, 'tạm dừng không chiếm chỗ');
  assert.equal(ads.findSlotConflict(slot({ id: 'b', status: 'paused' }), existing), null, 'tạm dừng không bị chặn');
  assert.equal(ads.findSlotConflict(slot({ id: 'a' }), existing), null, 'sửa chính nó không tự trùng');
  assert.equal(ads.findSlotConflict(slot({ id: 'b', placement: 'service_card' }), [slot({ placement: 'service_card' })]), null, 'card không giới hạn');
  assert.ok(ads.findSlotConflict(slot({ id: 'b', placement: 'homepage_banner', kcn_ids: [] }), [slot({ placement: 'homepage_banner', kcn_ids: [] })]), 'banner trang chủ chỉ một');
  assert.equal(ads.findSlotConflict(slot({ id: 'b', placement: 'sidebar', kcn_ids: [] }), [slot({ placement: 'homepage_banner', kcn_ids: [] })]), null, 'khác vị trí');
});

// ── Chọn quảng cáo để hiển thị ──
const row = (over = {}) => ({ id: 'x', placement: 'homepage_banner', title: 'T', body: null, image_url: 'https://i/x.jpg', link_url: null, is_hot: false, kcn_ids: [], show_on_web: true, show_on_app: true, starts_on: '2026-11-01', ends_on: '2026-11-30', status: 'active', customer_note: 'KHÁCH A 1.5tr', created_at: '2026-10-30T00:00:00Z', ...over });
const pick = (rows, options) => ads.selectAds(rows, { today: '2026-11-15', channel: 'web', placement: 'homepage_banner', ...options });

test('only running ads for the right channel are shown, and the last day still counts', () => {
  assert.equal(pick([row()]).length, 1);
  assert.equal(pick([row()], { today: '2026-11-01' }).length, 1, 'ngày đầu');
  assert.equal(pick([row()], { today: '2026-11-30' }).length, 1, 'ngày cuối');
  assert.equal(pick([row()], { today: '2026-10-31' }).length, 0, 'chưa tới');
  assert.equal(pick([row()], { today: '2026-12-01' }).length, 0, 'hết hạn');
  assert.equal(pick([row({ status: 'paused' })]).length, 0);
  assert.equal(pick([row({ show_on_web: false })]).length, 0);
  assert.equal(pick([row({ show_on_app: false })], { channel: 'app' }).length, 0);
  assert.equal(pick([row({ show_on_app: false })], { channel: 'web' }).length, 1);
});

test('KCN ads show only for their KCN; single-slot placements return one ad; cards put HOT first', () => {
  const banner = row({ placement: 'kcn_banner', kcn_ids: [K1, K2] });
  assert.equal(pick([banner], { placement: 'kcn_banner', kcnId: K2 }).length, 1, 'Bundle hiện ở KCN thứ 2');
  assert.equal(pick([banner], { placement: 'kcn_banner', kcnId: K3 }).length, 0);
  assert.equal(pick([banner], { placement: 'kcn_banner' }).length, 0, 'không biết KCN thì không hiện');
  assert.equal(pick([row({ id: 'old' }), row({ id: 'new', starts_on: '2026-11-10' })]).map(ad => ad.id).join(), 'new', 'dữ liệu lỡ có hai: lấy cái mới hơn, chỉ một');

  const card = (id, over) => row({ id, placement: 'service_card', kcn_ids: [K1], ...over });
  const order = pick([card('plain-new', { created_at: '2026-11-05T00:00:00Z' }), card('hot-old', { is_hot: true, created_at: '2026-11-01T00:00:00Z' }), card('plain-old', { created_at: '2026-11-02T00:00:00Z' }), card('hot-new', { is_hot: true, created_at: '2026-11-04T00:00:00Z' })], { placement: 'service_card', kcnId: K1 }).map(ad => ad.id);
  assert.deepEqual(order, ['hot-new', 'hot-old', 'plain-new', 'plain-old'], 'HOT trước, trong nhóm thì mới nhất trước');
});

test('public ads never expose the internal customer note, status or dates', () => {
  const [shown] = pick([row()]);
  assert.deepEqual(Object.keys(shown).sort(), ['body', 'id', 'imageUrl', 'isHot', 'kcnIds', 'linkUrl', 'placement', 'title']);
  assert.ok(!JSON.stringify(shown).includes('KHÁCH A'));
  assert.ok(ads.AD_PUBLIC_FIELDS && !ads.AD_PUBLIC_FIELDS.includes('customer_note'));
  assert.equal(ads.toAdminAd(row(), '2026-11-15').customer_note, 'KHÁCH A 1.5tr');
  assert.equal(ads.toAdminAd(row(), '2026-12-15').running, false);
});

test('"today" follows Vietnam time, so an ad ends at Vietnamese midnight, not UTC midnight', () => {
  assert.equal(ads.adToday(new Date('2026-11-30T16:59:00Z')), '2026-11-30');
  assert.equal(ads.adToday(new Date('2026-11-30T17:00:00Z')), '2026-12-01', '00:00 giờ Việt Nam');
});

// ── Kích thước ảnh theo khung ──
import * as img from '../src/lib/ad-image.ts';

const png = (w, h) => { const b = new Uint8Array(33); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h); return b; };
const jpeg = (w, h) => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
const webpX = (w, h) => { const b = new Uint8Array(30); b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58]); const wi = w - 1, hi = h - 1; b.set([wi & 255, (wi >> 8) & 255, (wi >> 16) & 255], 24); b.set([hi & 255, (hi >> 8) & 255, (hi >> 16) & 255], 27); return b; };
const webpL = (w, h) => { const b = new Uint8Array(30); b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c, 0, 0, 0, 0, 0x2f]); const bits = ((w - 1) | ((h - 1) << 14)) >>> 0; b.set([bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >>> 24) & 255], 21); return b; };

test('image dimensions are read from PNG, JPEG and WEBP headers and anything else is unreadable', () => {
  assert.deepEqual(img.readImageSize(png(1200, 400)), { width: 1200, height: 400 });
  assert.deepEqual(img.readImageSize(jpeg(1280, 720)), { width: 1280, height: 720 });
  assert.deepEqual(img.readImageSize(webpX(300, 600)), { width: 300, height: 600 });
  assert.deepEqual(img.readImageSize(webpL(640, 360)), { width: 640, height: 360 });
  for (const junk of [new Uint8Array(0), new Uint8Array(40), Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]), new TextEncoder().encode('GIF89a......................................')]) assert.equal(img.readImageSize(junk), null);
});

test('each placement accepts only its frame ratio and width range', () => {
  const err = (placement, w, h) => img.adImageSizeError(placement, w, h);
  for (const placement of ['homepage_banner', 'kcn_banner']) {
    assert.equal(err(placement, 1200, 400), null, 'đúng chuẩn');
    assert.equal(err(placement, 3000, 1000), null);
    assert.equal(err(placement, 1200, 408), null, 'lệch dưới 2%');
    assert.match(err(placement, 1200, 1200), /không đúng tỉ lệ 3:1/);
    assert.match(err(placement, 1200, 450), /không đúng tỉ lệ 3:1/, 'lệch 12%');
    assert.match(err(placement, 900, 300), /quá nhỏ/);
    assert.match(err(placement, 4500, 1500), /quá lớn/);
  }
  assert.equal(err('sidebar', 300, 600), null);
  assert.match(err('sidebar', 600, 300), /1:2/);
  assert.match(err('sidebar', 200, 400), /quá nhỏ/);
  assert.equal(err('service_card', 1280, 720), null);
  assert.equal(err('service_card', 640, 360), null);
  assert.match(err('service_card', 1200, 400), /16:9/);
  assert.match(err('service_card', 320, 180), /quá nhỏ/);
  assert.match(err('service_card', 0, 0), /Không đọc được/);
  assert.match(img.adImageHint('homepage_banner'), /1200×400/);
});

test('only images uploaded through the ads folder are accepted as ad images', () => {
  assert.equal(ads.isAdImageUrl('https://res.cloudinary.com/demo/image/upload/v1699999999/ads/abc123.jpg'), true);
  assert.equal(ads.isAdImageUrl('https://res.cloudinary.com/demo/image/upload/ads/abc123.webp'), true);
  for (const url of ['http://res.cloudinary.com/demo/image/upload/v1/ads/a.jpg', 'https://evil.com/demo/image/upload/v1/ads/a.jpg', 'https://res.cloudinary.com/demo/image/upload/v1/momo-qr/a.jpg', 'https://res.cloudinary.com/demo/image/upload/w_10/v1/ads/a.jpg', 'https://res.cloudinary.com/demo/image/upload/v1/ads/a.gif', 'https://res.cloudinary.com/demo/image/upload/v1/ads/../x/a.jpg', 'not a url']) assert.equal(ads.isAdImageUrl(url), false, url);
});
