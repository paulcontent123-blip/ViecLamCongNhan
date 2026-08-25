// Định dạng dùng chung giữa JobCard (thẻ rút gọn) và JobDetailContent (trang/modal
// chi tiết) — tách ra đây để 2 nơi hiển thị luôn khớp nhau, không lệch logic.

export function formatSalary(min: number | null, max: number | null): string {
  const fmt = (v: number) => (v / 1_000_000).toLocaleString("vi-VN");
  if (min && max) return `${fmt(min)} – ${fmt(max)} triệu/tháng`;
  if (max) return `Tới ${fmt(max)} triệu/tháng`;
  if (min) return `Từ ${fmt(min)} triệu/tháng`;
  return "Thỏa thuận";
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "Vừa đăng";
  if (hours < 24) return `Đăng ${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `Đăng ${days} ngày trước`;
}

export const INDUSTRY_ICON: Record<string, string> = {
  may_mac: "👚",
  dien_tu: "📱",
  kho_van: "📦",
  co_khi: "⚙️",
  thuc_pham: "🍱",
  xay_dung: "🏗️",
  van_tai: "🚚",
};

const JOB_TYPE_LABEL: Record<string, string> = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  seasonal: "Thời vụ",
};

/** Số ngày còn lại tới expires_at, tối thiểu 0 (không trả số âm khi đã hết hạn). */
export function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / 86_400_000));
}

export function jobTypeLabel(value: string | null): string | null {
  return value ? (JOB_TYPE_LABEL[value] ?? value) : null;
}

const SHIFT_LABEL: Record<string, string> = {
  day: "☀️ Ca ngày",
  night: "🌙 Ca đêm",
  rotating: "🔄 Ca xoay",
};

export function shiftLabel(value: string | null): string | null {
  return value ? (SHIFT_LABEL[value] ?? value) : null;
}
