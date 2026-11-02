import "server-only";
import { cookies } from "next/headers";
import {
  EMPLOYER_SESSION_COOKIE,
  verifyEmployerSessionToken,
  type EmployerSessionPayload,
} from "@/lib/employer-session";
import { readSessionUser } from "@/lib/session-user";
import { isSessionRevoked } from "@/lib/session-revocation";

/**
 * Đọc + verify phiên NTD từ cookie trong Server Component / Route Handler.
 * middleware.ts chặn truy cập dashboard khi token không hợp lệ; hàm này kiểm tra
 * thêm trạng thái trong DB để thu hồi ngay phiên của tài khoản đã bị xóa.
 */
export async function getEmployerSession(): Promise<EmployerSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(EMPLOYER_SESSION_COOKIE)?.value;
  const session = token ? await verifyEmployerSessionToken(token) : null;
  if (!session) return null;

  // Thu hồi ngay cả phiên JWT cũ khi tài khoản đã được đánh dấu Đã xóa.
  const { data: user } = await readSessionUser(session.userId);
  if (!user || user.role !== "employer" || user.status !== "active") return null;
  if (isSessionRevoked(session, user.password_changed_at)) return null;

  return session;
}
