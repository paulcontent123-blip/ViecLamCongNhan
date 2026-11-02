import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface SessionUserRow {
  role: string;
  status: string;
  password_changed_at?: string | null;
  admin_role?: string | null;
  is_verified?: boolean;
  phone?: string | null;
  password_hash?: string | null;
}

/**
 * Đọc dòng người dùng để kiểm tra phiên: vai trò, trạng thái và mốc đổi mật khẩu, kèm các cột phụ nếu cần.
 * Nếu cột password_changed_at chưa có (web deploy trước migration) thì đọc lại không có cột đó, nghĩa là chưa thu hồi theo
 * mật khẩu nhưng không khóa ai; lỗi khác trả nguyên cho nơi gọi xử lý.
 */
export async function readSessionUser(userId: string, extraColumns = ""): Promise<{ data: SessionUserRow | null; error: { code?: string; message: string } | null }> {
  const supabase = createSupabaseAdminClient();
  const base = extraColumns ? `role,status,${extraColumns}` : "role,status";
  const first = await supabase.from("users").select(`${base},password_changed_at`).eq("id", userId).maybeSingle();
  if (first.error?.code === "42703") {
    const retry = await supabase.from("users").select(base).eq("id", userId).maybeSingle();
    return { data: retry.data as SessionUserRow | null, error: retry.error };
  }
  return { data: first.data as SessionUserRow | null, error: first.error };
}
