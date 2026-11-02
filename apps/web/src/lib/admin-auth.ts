import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken, type AdminSessionPayload } from "@/lib/admin-session";
import { adminCan, isAdminRole, type AdminCapability, type AdminRole } from "@/lib/admin-roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { ROUTES } from "@/lib/routes";

export type AdminSession = AdminSessionPayload & { adminRole: AdminRole };

/**
 * Đọc + verify phiên Admin từ cookie trong Server Component / Route Handler.
 * middleware.ts chặn truy cập /admin/* khi token không hợp lệ; hàm này kiểm tra
 * thêm trạng thái và cấp quyền trong DB (không tin JWT) để thu hồi phiên của tài khoản
 * đã bị xóa và để đổi quyền có hiệu lực ngay ở lần gọi kế tiếp.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const session = token ? await verifyAdminSessionToken(token) : null;
  if (!session) return null;

  // JWT còn hạn nhưng tài khoản có thể đã bị Admin đánh dấu Đã xóa sau khi
  // token được cấp. Kiểm tra lại DB để thu hồi ngay phiên đang tồn tại.
  const supabase = createSupabaseAdminClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("role, status, admin_role")
    .eq("id", session.userId)
    .maybeSingle();

  if (error) {
    // 42703: cột admin_role chưa có (web được deploy trước migration phân quyền). Giữ hành vi cũ, coi như
    // superadmin, để không khóa toàn bộ Admin; mọi lỗi khác thì từ chối (không mở quyền khi lỗi).
    if (error.code === "42703") {
      const { data: legacy } = await supabase.from("users").select("role, status").eq("id", session.userId).maybeSingle();
      if (!legacy || legacy.role !== "admin" || legacy.status !== "active") return null;
      logSafeSupabaseError({ route: "lib/admin-auth", operation: "admin_role_column_missing", error });
      return { ...session, adminRole: "superadmin" };
    }
    logSafeSupabaseError({ route: "lib/admin-auth", operation: "read_admin_session", error });
    return null;
  }
  if (!user || user.role !== "admin" || user.status !== "active") return null;
  // Tài khoản Admin chưa có cấp quyền (không nên xảy ra nhờ ràng buộc DB) chỉ được quyền thấp nhất.
  const adminRole: AdminRole = isAdminRole(user.admin_role) ? user.admin_role : "editor";

  return { ...session, adminRole };
}

export const ADMIN_FORBIDDEN_MESSAGE = "Bạn không có quyền thực hiện thao tác này. Cần tài khoản Superadmin.";

export type RequireAdminResult =
  | { session: AdminSession; error?: undefined }
  | { session?: undefined; error: NextResponse };

/**
 * Dùng ở Route Handler: 401 khi chưa đăng nhập, 403 khi thiếu quyền. Không đổi 403 thành 401 để app
 * không nhầm là phiên hết hạn và đăng xuất người dùng.
 */
export async function requireAdmin(capability?: AdminCapability): Promise<RequireAdminResult> {
  const session = await getAdminSession();
  if (!session) return { error: NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 }) };
  if (capability && !adminCan(session.adminRole, capability)) {
    return { error: NextResponse.json({ error: ADMIN_FORBIDDEN_MESSAGE }, { status: 403 }) };
  }
  return { session };
}

/** Dùng ở Server Component (trang): chưa đăng nhập thì về trang đăng nhập, thiếu quyền thì về trang tổng quan. */
export async function requireAdminPage(capability?: AdminCapability): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect(ROUTES.adminLogin);
  if (capability && !adminCan(session.adminRole, capability)) redirect(ROUTES.admin);
  return session;
}
