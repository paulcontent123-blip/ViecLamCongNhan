import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MESSAGES: Record<string, { error: string; status: 403 | 404 | 409 }> = {
  ADMIN_FORBIDDEN: { error: "Bạn không còn quyền Superadmin.", status: 403 },
  ACCOUNT_NOT_FOUND: { error: "Không tìm thấy tài khoản.", status: 404 },
  ACCOUNT_INACTIVE: { error: "Tài khoản không còn hoạt động.", status: 409 },
  ACCOUNT_CHANGED: { error: "Tài khoản đã thay đổi. Vui lòng tải lại trước khi lưu.", status: 409 },
  SELF_PROTECTED: { error: "Không thể tự xóa hoặc đổi cấp quyền tài khoản đang đăng nhập.", status: 409 },
  LAST_SUPERADMIN: { error: "Không thể xóa hoặc hạ quyền Superadmin cuối cùng.", status: 409 },
  LINKED_PARTNER_ROLE: { error: "Tài khoản có hồ sơ đối tác liên kết, không thể đổi vai trò.", status: 409 },
};

export async function mutateAdminAccount(actorId: string, action: "create" | "update" | "delete", userId: string | null, changes: Record<string, unknown>, expected: Record<string, unknown> | null = null) {
  const { data, error } = await createSupabaseAdminClient().rpc("admin_mutate_user", {
    p_actor: actorId, p_action: action, p_target: userId, p_changes: changes, p_expected: expected,
  });
  if (error || !data) {
    if (error?.code === "23505") return { ok: false as const, error: "Email hoặc số điện thoại đã được sử dụng.", status: 409 as const };
    const known = error?.code === "P0001" ? MESSAGES[error.message] : undefined;
    return { ok: false as const, ...(known || { error: "Không cập nhật được tài khoản. Vui lòng thử lại sau.", status: 500 as const }) };
  }
  return { ok: true as const, user: data as Record<string, unknown> };
}
