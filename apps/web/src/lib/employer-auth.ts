import "server-only";
import { cookies } from "next/headers";
import {
  EMPLOYER_SESSION_COOKIE,
  verifyEmployerSessionToken,
  type EmployerSessionPayload,
} from "@/lib/employer-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  const supabase = createSupabaseAdminClient();
  const { data: user } = await supabase
    .from("users")
    .select("role, status")
    .eq("id", session.userId)
    .maybeSingle();
  if (!user || user.role !== "employer" || user.status !== "active") return null;

  return session;
}
