import "server-only";
import type { AdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

/**
 * Ghi nhật ký thao tác nhạy cảm của Admin (thanh toán, đối tác, quản lý Admin, quà tiền mặt).
 * Chỉ ghi việc đã xảy ra; lỗi ghi nhật ký được ghi log và không làm hỏng thao tác chính.
 * Không đưa mật khẩu, số tài khoản hay dữ liệu cá nhân vào `detail`.
 */
export async function logAdminAction(
  session: AdminSession,
  action: string,
  target?: { type: string; id?: string },
  detail: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { error } = await createSupabaseAdminClient().from("admin_audit_log").insert({
      admin_id: session.userId,
      admin_email: session.email || null,
      admin_role: session.adminRole,
      action,
      target_type: target?.type ?? null,
      target_id: target?.id ?? null,
      detail,
    });
    if (error) logSafeSupabaseError({ route: "lib/admin-audit", operation: `log_${action}`, error });
  } catch (error) {
    logSafeSupabaseError({ route: "lib/admin-audit", operation: `log_${action}`, error: error instanceof Error ? error : new Error("audit_log_failed") });
  }
}
