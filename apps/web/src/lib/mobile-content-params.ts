/** Validate pagination for public mobile content endpoints. */
export function parseMobilePagination(
  searchParams: URLSearchParams,
  defaultLimit: number,
): { limit: number; offset: number } {
  function integerParam(key: "limit" | "offset", fallback: number, minimum: number): number {
    const raw = searchParams.get(key);
    if (raw === null) return fallback;
    if (!/^(0|[1-9]\d*)$/.test(raw)) throw new RangeError(`${key} phải là số nguyên hợp lệ.`);
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < minimum) throw new RangeError(`${key} không hợp lệ.`);
    return value;
  }

  const limit = integerParam("limit", defaultLimit, 1);
  const offset = integerParam("offset", 0, 0);
  if (limit > 30) throw new RangeError("limit tối đa 30.");
  // Supabase .range() is inclusive; keep the end index a safe integer.
  if (!Number.isSafeInteger(offset + limit - 1)) throw new RangeError("offset không hợp lệ.");
  return { limit, offset };
}

export function parseMobileSlug(slug: string): string {
  if (!slug || slug !== slug.trim() || slug.length > 200) {
    throw new RangeError("slug không hợp lệ.");
  }
  return slug;
}

export function parseMobileCategory(
  value: string | null,
  categories: Record<string, unknown>,
): string | undefined {
  if (value === null) return undefined;
  if (!Object.prototype.hasOwnProperty.call(categories, value)) {
    throw new RangeError("Danh mục bài viết không hợp lệ.");
  }
  return value;
}
