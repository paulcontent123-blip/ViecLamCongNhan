import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeQuestion, contactKey, contactKind, countUrls, normalizeQuestionText } from '../src/lib/spam-guard.ts';

test('normal Vietnamese questions pass', () => {
  for (const text of ['Làm thêm giờ ban đêm thì được trả lương bao nhiêu?', 'Công ty chưa đóng BHXH cho tôi 3 tháng, tôi phải làm gì?', 'Mình ký hợp đồng thử việc 2 tháng có được hưởng bảo hiểm không?']) {
    assert.deepEqual(analyzeQuestion(text), { ok: true }, text);
  }
});

test('spam patterns are rejected with a reason', () => {
  const cases = [
    ['Xem tại http://a.com và https://b.com để biết thêm chi tiết nhé', 'too_many_links'],
    ['aaaaaaaaaaaaaaa hỏi gì đó', 'repeated_characters'],
    ['!!!! ???? 1234 5678 ....', 'mostly_symbols'],
    ['lương lương lương lương lương lương lương cao', 'repeated_words'],
    ['ababababab ababababab', 'low_variety'],
    ['Nhà cái uy tín, ca cuoc online nhận ngay thưởng lớn', 'blocked_keyword'],
    ['x'.repeat(2001), 'too_long'],
  ];
  for (const [text, reason] of cases) {
    const verdict = analyzeQuestion(text);
    assert.equal(verdict.ok, false, text);
    assert.equal(verdict.reason, reason, text);
    assert.ok(verdict.message);
  }
  assert.equal(analyzeQuestion('Xem thêm tại https://example.com/luat-lao-dong có đúng không ạ?').ok, true, 'one link is allowed');
});

test('blocked phrases match whole words only and ignore diacritics', () => {
  assert.equal(analyzeQuestion('Tôi muốn hỏi về CA CƯỢC trực tuyến có hợp pháp không').ok, false);
  assert.equal(analyzeQuestion('Công ty có chính sách casinoblabla nào không nhỉ bạn?').ok, true);
});

test('contact must be a real phone or email and is keyed consistently', () => {
  assert.equal(contactKind('0901234567'), 'phone');
  assert.equal(contactKind('+84 901 234 567'), 'phone');
  assert.equal(contactKind('84901234567'), 'phone');
  assert.equal(contactKind('An@Example.com'), 'email');
  assert.equal(contactKind('123456'), null);
  assert.equal(contactKind('0000000000'), null);
  assert.equal(contactKind('abc'), null);
  assert.equal(contactKey('+84 901 234 567'), '0901234567');
  assert.equal(contactKey('0901.234.567'), '0901234567');
  assert.equal(contactKey(' An@Example.COM '), 'an@example.com');
});

test('normalization makes duplicates comparable', () => {
  assert.equal(normalizeQuestionText('  Lương, THƯỞNG?? tết... '), 'luong thuong tet');
  assert.equal(normalizeQuestionText('Đi làm  Đêm'), 'di lam dem');
  assert.equal(countUrls('a https://x.com b www.y.vn c'), 2);
});
