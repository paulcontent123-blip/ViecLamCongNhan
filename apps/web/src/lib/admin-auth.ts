import "server-only";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken, type AdminSessionPayload } from "@/lib/admin-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Đọc + verify phiên Admin từ cookie trong Server Component / Route Handler.
 * middleware.ts chặn truy cập /admin/* khi token không hợp lệ; hàm này kiểm tra
 * thêm trạng thái trong DB để thu hồi phiên của tài khoản đã bị xóa.
 */
export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  if (!session) return null;

  // JWT còn hạn nhưng tài khoản có thể đã bị Admin đánh dấu Đã xóa sau khi
  // token được cấp. Kiểm tra lại DB để thu hồi ngay phiên đang tồn tại.
  const supabase = createSupabaseAdminClient();
  const { data: user } = await supabase
    .from("users")
    .select("role, status")
    .eq("id", session.userId)
    .maybeSingle();
  if (!user || user.role !== "admin" || user.status !== "active") return null;

  return session;
}
