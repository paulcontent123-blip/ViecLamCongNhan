// Hiển thị ngày giờ theo múi giờ Việt Nam (UTC+7), cố định, không phụ thuộc máy đang chạy.
// Các trang dựng trên máy chủ chạy giờ quốc tế (UTC): gọi toLocaleString("vi-VN") không chỉ định múi giờ sẽ lệch 7 tiếng
// so với app, và hiện sai ngày trong khoảng 17:00 đến 24:00 giờ Việt Nam. Dữ liệu trong cơ sở dữ liệu vẫn lưu giờ quốc tế.
// Không import server-only để dùng được ở cả máy chủ lẫn trình duyệt.

export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";
const EMPTY = "‑";

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Ngày và giờ, ví dụ "23:01:56 2/11/2026". Thiếu hoặc không hợp lệ thì trả "‑". */
export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  return date ? date.toLocaleString("vi-VN", { timeZone: VN_TIME_ZONE }) : EMPTY;
}

/** Chỉ ngày, ví dụ "2/11/2026". Thiếu hoặc không hợp lệ thì trả "‑". */
export function formatDate(value: DateInput): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString("vi-VN", { timeZone: VN_TIME_ZONE }) : EMPTY;
}
