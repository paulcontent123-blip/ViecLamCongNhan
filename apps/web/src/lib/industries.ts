// Ngành nghề cho tin tuyển dụng (jobs.industry là free text, không ràng buộc enum
// ở DB — danh sách này là "gợi ý chuẩn hoá" dùng chung giữa filter sidebar và seed).
// Ngoài danh sách này, NTD/ứng viên có thể chọn "Ngành nghề khác" và tự gõ tên —
// xem OTHER_INDUSTRY_VALUE + IndustrySelect/IndustryFilterSelect.
export const JOB_INDUSTRIES = [
  { value: "may_mac", label: "May mặc · Giày da" },
  { value: "dien_tu", label: "Điện tử · Lắp ráp" },
  { value: "kho_van", label: "Kho vận · Bốc xếp" },
  { value: "co_khi", label: "Cơ khí · Hàn" },
  { value: "thuc_pham", label: "Thực phẩm · Đồ uống" },
  { value: "xay_dung", label: "Xây dựng" },
  { value: "van_tai", label: "Vận tải · Tài xế" },
] as const;

export type JobIndustry = (typeof JOB_INDUSTRIES)[number]["value"];

export function industryLabel(value: string | null | undefined): string {
  return JOB_INDUSTRIES.find((i) => i.value === value)?.label ?? value ?? "";
}

// employers.industry KHÔNG còn ràng buộc enum ở DB (đã bỏ CHECK constraint, xem
// migration 20260820110001) — danh sách này giờ cũng chỉ là gợi ý, có thể tự gõ
// "Ngành nghề khác" giống JOB_INDUSTRIES.
export const EMPLOYER_INDUSTRIES = [
  { value: "may_mac", label: "May mặc · Giày da" },
  { value: "dien_tu", label: "Điện tử · Lắp ráp" },
  { value: "co_khi", label: "Cơ khí · Hàn" },
  { value: "thuc_pham", label: "Thực phẩm · Đồ uống" },
  { value: "hoa_chat", label: "Hóa chất" },
] as const;

// Sentinel value chỉ dùng nội bộ ở UI (IndustrySelect/IndustryFilterSelect) để biết
// lúc nào hiện ô nhập tự do — KHÔNG BAO GIỜ được gửi lên server hay lưu vào DB, giá
// trị thật gửi đi luôn là tên ngành NTD/ứng viên tự gõ.
export const OTHER_INDUSTRY_VALUE = "__khac__";

/**
 * Chuẩn hoá để so khớp ngành nghề không phân biệt hoa/thường, có dấu hay không dấu
 * (VD: "May Mặc", "may mac", "MAY MAC" đều khớp nhau) — PHẢI cho ra kết quả giống hệt
 * hàm SQL public.text_search_key() ở migration 20260820110001, vì 1 bên chuẩn hoá lúc
 * lưu (generated column industry_key/desired_industry_key), 1 bên chuẩn hoá lúc lọc
 * (dùng hàm này) rồi so bằng .eq() — sai lệch dù nhỏ cũng làm lọc/auto-blast bỏ sót.
 */
export function normalizeIndustryText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

/**
 * Chuẩn hoá + escape ký tự đặc biệt của SQL LIKE (%, _, \) rồi bọc %...% — dùng với
 * .ilike("industry_key"/"desired_industry_key", ...) để lọc theo TỪNG PHẦN ký tự gõ
 * vào (VD: gõ "sản xuất" vẫn khớp "Sản xuất - vận hành máy"), không cần gõ đủ nguyên
 * cụm như so khớp tuyệt đối .eq() trước đây.
 */
export function industryLikePattern(value: string): string {
  const escaped = normalizeIndustryText(value).replace(/[\\%_]/g, (c) => `\\${c}`);
  return `%${escaped}%`;
}
