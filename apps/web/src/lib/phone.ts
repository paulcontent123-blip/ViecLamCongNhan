/** Chuẩn hóa số điện thoại để liên kết yêu cầu tư vấn với tài khoản.
 * Giữ lại số 0 đầu Việt Nam và bỏ khoảng trắng, dấu chấm, dấu gạch ngang...
 */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length === 11) return `0${digits.slice(2)}`;
  return digits;
}
