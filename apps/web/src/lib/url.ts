export function buildQuery(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
): string {
  // Đổi filter luôn reset về trang 1 — trừ khi overrides chủ động truyền lại
  // (vd. nút chuyển trang cần giữ nguyên filter, chỉ đổi page).
  const merged: Record<string, string | undefined> = { ...current };
  delete merged.page;
  Object.assign(merged, overrides);

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
