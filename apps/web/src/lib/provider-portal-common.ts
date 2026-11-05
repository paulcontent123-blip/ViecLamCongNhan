// Hằng số và hàm thuần dùng chung cho các cổng đối tác Bảo hiểm, Tài chính, Thuê trọ.
//
// BẢN SAO QUY TẮC CỦA APP: nhãn lấy đúng như app đang hiện (`utils/insuranceProviderForm.js`,
// `utils/financeProviderForm.js`, `screens/partner/RentalProvider*.js`). Đổi một bên thì đổi cả hai.
//
// Tệp thuần dữ liệu, không import gì, nên chạy trực tiếp bằng node được.

export type StatusTone = "amber" | "green" | "red" | "gray" | "blue";

// ───────── Sản phẩm (Bảo hiểm, Tài chính) ─────────

/** Trạng thái lọc được ở `products` của Bảo hiểm và Tài chính. */
export const PRODUCT_STATUSES = ["draft", "pending", "approved", "rejected", "hidden"] as const;

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  draft: "Bản nháp",
  pending: "Chờ Admin duyệt",
  approved: "Đã duyệt",
  rejected: "Cần chỉnh sửa",
  hidden: "Đã ẩn",
};

export const PRODUCT_STATUS_TONE: Record<string, StatusTone> = {
  draft: "gray",
  pending: "amber",
  approved: "green",
  rejected: "red",
  hidden: "gray",
};

export const PRODUCT_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "draft", label: "Nháp" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Cần chỉnh sửa" },
  { value: "hidden", label: "Đã ẩn" },
];

// ───────── Yêu cầu tư vấn / yêu cầu thuê ─────────

/** Bảo hiểm và Tài chính có 5 trạng thái; Thuê trọ chỉ có 4 (không có "Đang tư vấn"). */
export const CONSULT_INQUIRY_STATUSES = ["new", "contacted", "advising", "resolved", "cancelled"] as const;
export const RENTAL_INQUIRY_STATUSES = ["new", "contacted", "resolved", "cancelled"] as const;

export const CONSULT_INQUIRY_LABEL: Record<string, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  advising: "Đang tư vấn",
  resolved: "Đã xử lý",
  cancelled: "Đã hủy",
};

export const CONSULT_INQUIRY_TONE: Record<string, StatusTone> = {
  new: "amber",
  contacted: "blue",
  advising: "blue",
  resolved: "green",
  cancelled: "red",
};

/**
 * Các bước đối tác được đổi sang. KHÔNG có "new": máy chủ không cho quay về trạng thái mới
 * (schema của `inquiries/[id]` chỉ nhận các giá trị còn lại).
 */
export const CONSULT_INQUIRY_TRANSITIONS = ["contacted", "advising", "resolved", "cancelled"] as const;
export const RENTAL_INQUIRY_TRANSITIONS = ["contacted", "resolved", "cancelled"] as const;

export function inquiryFilters(statuses: readonly string[], label: Record<string, string>) {
  return [{ value: "", label: "Tất cả" }, ...statuses.map((value) => ({ value, label: label[value] ?? value }))];
}

// ───────── Kiểm tra giá trị ─────────

/** Ngày dạng YYYY-MM-DD có thật (không chấp nhận 2026-02-31). */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Liên kết http(s) có tên miền, cùng mẫu với app và các route Tài chính. */
export function isHttpUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+\.[^\s]+$/i.test(value);
}

const trim = (value: string | undefined) => (value ?? "").trim();

export type Values = Record<string, string>;

/** So khớp hồ sơ đọc lại với nội dung vừa gửi: mọi khoá của `fromProfile` phải bằng giá trị đã cắt khoảng trắng. */
export function valuesMatch(now: Values, sent: Values): boolean {
  return Object.keys(now).every((key) => now[key] === trim(sent[key]));
}

export function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// ───────── Ô nhập dựng theo cấu hình ─────────

/** Mô tả một ô nhập của form đăng ký, hồ sơ hoặc sản phẩm. Giao diện dựng ô từ danh sách này (`FieldGrid`). */
export type FieldDef = {
  key: string;
  label: string;
  kind?: "text" | "tel" | "email" | "password" | "date" | "select" | "textarea";
  options?: { value: string; label: string }[];
  /** Dòng chữ chọn mặc định của ô `select` (để trống = không có mục rỗng). */
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  /** Chiếm nửa hàng (ghép cặp với ô `half` liền sau). */
  half?: boolean;
  /** Gợi ý nhỏ dưới ô. */
  hint?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
};
