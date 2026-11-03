import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDate, formatDateTime, VN_TIME_ZONE } from '../src/lib/format-date.ts';

// 16:01:56 giờ quốc tế = 23:01:56 giờ Việt Nam (đúng ca lệch 7 tiếng đã thấy ở trang Yêu cầu dịch vụ công nhân).
test('date and time are shown in Vietnam time, not in the time of the machine', () => {
  assert.equal(VN_TIME_ZONE, 'Asia/Ho_Chi_Minh');
  assert.equal(formatDateTime('2026-11-02T16:01:56Z'), '23:01:56 2/11/2026');
  assert.equal(formatDateTime(new Date('2026-11-02T16:01:56Z')), '23:01:56 2/11/2026');
  assert.equal(formatDateTime(Date.parse('2026-11-02T16:01:56Z')), '23:01:56 2/11/2026');
});

test('date only switches to the next day at midnight Vietnam time, not at midnight UTC', () => {
  assert.equal(formatDate('2026-11-02T16:59:59Z'), '2/11/2026');
  assert.equal(formatDate('2026-11-02T17:00:00Z'), '3/11/2026');
  assert.equal(formatDate('2026-12-31T20:00:00Z'), '1/1/2027');
});

test('missing or invalid values show a dash instead of "Invalid Date"', () => {
  for (const value of [null, undefined, '', 'không phải ngày', NaN]) {
    assert.equal(formatDateTime(value), '‑', String(value));
    assert.equal(formatDate(value), '‑', String(value));
  }
});

test('the result does not depend on the TZ of the process', () => {
  const original = process.env.TZ;
  try {
    for (const zone of ['UTC', 'America/New_York', 'Asia/Tokyo']) {
      process.env.TZ = zone;
      assert.equal(formatDateTime('2026-11-02T16:01:56Z'), '23:01:56 2/11/2026', zone);
    }
  } finally {
    if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
  }
});
