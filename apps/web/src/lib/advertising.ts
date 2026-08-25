import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Đếm đúng số hồ sơ công nhân trong database để hiển thị quy mô tệp tiếp cận
 * trên trang Quảng cáo/Hợp tác. Chỉ trả về số đếm, không trả dữ liệu cá nhân.
 */
export async function getAdvertisingAudienceCount(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase.from("candidates").select("id", { count: "exact", head: true });

  if (error) {
    console.error("getAdvertisingAudienceCount error:", error.message);
    return 0;
  }
  return count ?? 0;
}
