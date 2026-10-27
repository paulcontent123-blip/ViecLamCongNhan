import { PROVINCES } from "../provinces";

const strip = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Hồ sơ lưu tỉnh dạng chữ tự do (mã hoặc tên). Đổi về mã tỉnh nếu khớp rõ ràng, ngược lại null (không đoán). */
export function resolveProvinceCode(value: string | null | undefined): string | null {
  const text = (value || "").trim();
  if (!text) return null;
  const byCode = PROVINCES.find(item => item.code.toLowerCase() === text.toLowerCase());
  if (byCode) return byCode.code;
  const key = strip(text);
  if (!key) return null;
  const byName = PROVINCES.find(item => strip(item.name) === key || strip(item.name.replace(/^TP\.?\s*/i, "")) === key);
  return byName ? byName.code : null;
}
