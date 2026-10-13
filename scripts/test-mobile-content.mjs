import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseMobileCategory, parseMobilePagination, parseMobileSlug,
} from "../apps/web/src/lib/mobile-content-params.ts";

test("pagination defaults match each content group and support the final page", () => {
  assert.deepEqual(parseMobilePagination(new URLSearchParams(), 6), { limit: 6, offset: 0 });
  assert.deepEqual(parseMobilePagination(new URLSearchParams(), 9), { limit: 9, offset: 0 });
  assert.deepEqual(parseMobilePagination(new URLSearchParams(), 20), { limit: 20, offset: 0 });
  assert.deepEqual(parseMobilePagination(new URLSearchParams("limit=30&offset=60"), 6), { limit: 30, offset: 60 });
});

test("pagination rejects abuse and malformed values before the database query", () => {
  for (const query of [
    "limit=0", "limit=31", "limit=-1", "limit=2.5", "limit=1e3",
    "limit=", "limit=Infinity", "offset=-1", "offset=1.5",
    "offset=999999999999999999999", "offset=9007199254740991&limit=3",
  ]) {
    assert.throws(() => parseMobilePagination(new URLSearchParams(query), 6), RangeError, query);
  }
});

test("category accepts own keys only and rejects prototype names", () => {
  const categories = { luong_thuong: { label: "Lương & Thưởng" } };
  assert.equal(parseMobileCategory(null, categories), undefined);
  assert.equal(parseMobileCategory("luong_thuong", categories), "luong_thuong");
  for (const invalid of ["", "unknown", "toString", "constructor", "__proto__"]) {
    assert.throws(() => parseMobileCategory(invalid, categories), RangeError, invalid);
  }
});

test("slug rejects empty, padded and excessive input", () => {
  assert.equal(parseMobileSlug("quyen-loi-bhxh"), "quyen-loi-bhxh");
  for (const invalid of ["", " ", " abc", "abc ", "a".repeat(201)]) {
    assert.throws(() => parseMobileSlug(invalid), RangeError);
  }
});
