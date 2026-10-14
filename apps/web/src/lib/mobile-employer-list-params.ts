export function parseEmployerListParams(searchParams: URLSearchParams, statuses: readonly string[]) {
  function positiveInteger(key: "page" | "pageSize", fallback: number) {
    const raw = searchParams.get(key);
    if (raw === null) return fallback;
    if (!/^[1-9]\d*$/.test(raw)) throw new RangeError(`${key} phải là số nguyên dương.`);
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed)) throw new RangeError(`${key} không hợp lệ.`);
    return parsed;
  }

  const page = positiveInteger("page", 1);
  const pageSize = positiveInteger("pageSize", 20);
  if (pageSize > 50) throw new RangeError("pageSize tối đa 50.");
  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset + pageSize - 1)) throw new RangeError("page quá lớn.");

  const status = searchParams.get("status");
  if (status !== null && !statuses.includes(status)) throw new RangeError("Trạng thái không hợp lệ.");
  return { page, pageSize, offset, status: status ?? undefined };
}
