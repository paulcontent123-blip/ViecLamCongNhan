import { z } from "zod";

// Báo lỗi ứng dụng. Không import server-only để test được ngoài Next.

export const BUG_REPORT_ROLES = [
  "candidate", "employer", "training_provider", "rental_provider", "insurance_provider", "finance_provider", "health_provider",
] as const;
export type BugReportRole = (typeof BUG_REPORT_ROLES)[number];

export const BUG_REPORT_STATUSES = ["new", "in_progress", "resolved", "closed"] as const;
export type BugReportStatus = (typeof BUG_REPORT_STATUSES)[number];

/** Mỗi người gửi tối đa 5 báo lỗi trong 24 giờ; gửi lại đúng nội dung trong 10 phút được coi là cùng một báo lỗi (không tạo trùng). */
export const BUG_REPORT_DAILY_LIMIT = 5;
export const BUG_REPORT_DUPLICATE_WINDOW_MINUTES = 10;

export const BUG_REPORT_FIELDS =
  "id, reporter_role, title, description, app_version, platform, status, admin_note, created_at, updated_at, handled_at, reporter:users!reporter_user_id(full_name)";

/** Body gửi báo lỗi. role là vai trò của phiên đang đăng nhập (máy chủ kiểm tra phiên của đúng vai trò đó). */
export const bugReportCreateSchema = z.object({
  role: z.enum(BUG_REPORT_ROLES),
  title: z.string().trim().min(3, "Tiêu đề tối thiểu 3 ký tự.").max(100, "Tiêu đề tối đa 100 ký tự."),
  description: z.string().trim().min(10, "Mô tả tối thiểu 10 ký tự.").max(2000, "Mô tả tối đa 2000 ký tự."),
  appVersion: z.string().trim().max(30).regex(/^[\w.+-]*$/, "Phiên bản app không hợp lệ.").optional(),
  platform: z.enum(["android", "ios", "web"]).optional(),
}).strict();

/** Admin đổi trạng thái và/hoặc ghi chú; phải có ít nhất một trường. */
export const bugReportPatchSchema = z.object({
  status: z.enum(BUG_REPORT_STATUSES).optional(),
  adminNote: z.string().trim().max(1000, "Ghi chú tối đa 1000 ký tự.").nullable().optional(),
}).strict().refine((value) => value.status !== undefined || value.adminNote !== undefined, { message: "Không có trường cần cập nhật." });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validBugReportId(id: string) { return UUID.test(id); }

export interface BugReportRow {
  id: string;
  reporter_role: string;
  title: string;
  description: string;
  app_version: string | null;
  platform: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  handled_at: string | null;
  reporter?: { full_name?: string | null } | { full_name?: string | null }[] | null;
}

/** Đưa tên người gửi lên cùng cấp (reporter_name) để app Admin không phải đọc đối tượng lồng. */
export function flattenBugReport(row: BugReportRow) {
  const { reporter, ...rest } = row;
  const person = Array.isArray(reporter) ? reporter[0] : reporter;
  return { ...rest, reporter_name: person?.full_name ?? null };
}
