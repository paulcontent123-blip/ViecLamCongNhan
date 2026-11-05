import "server-only";
import { redirect } from "next/navigation";
import { getHealthProviderSession } from "@/lib/health-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ROUTES } from "@/lib/routes";

/**
 * Chặn các trang trong khu quản lý của Cơ sở y tế.
 *
 * Middleware hiện chỉ bảo vệ `/admin` và `/tuyen-dung/dashboard`, nên cổng này tự chặn ở từng trang thay vì
 * sửa `middleware.ts`. Chặn thật vẫn nằm ở máy chủ: mọi route `api/mobile/health-provider/*` đều tự kiểm
 * tra phiên và trả 401; đây chỉ để người dùng không mở được trang rồi thấy toàn lỗi.
 */
export async function requireHealthProviderPage() {
  const session = await getHealthProviderSession();
  if (!session) redirect(ROUTES.yTeDoiTacLogin);
  return session;
}

/**
 * Cơ sở đã được Admin xác minh chưa.
 *
 * Trạng thái này quyết định có gửi duyệt dịch vụ và mở liên hệ được không, nên đọc ngay ở máy chủ để giao diện
 * khoá đúng nút từ lần hiển thị đầu tiên. Đọc hỏng thì coi như CHƯA xác minh: thà khoá nhầm còn hơn mời người
 * dùng bấm vào chỗ máy chủ sẽ từ chối.
 */
export async function getHealthProviderVerified(providerId: string): Promise<boolean> {
  const { data } = await createSupabaseAdminClient()
    .from("health_providers")
    .select("is_verified")
    .eq("id", providerId)
    .maybeSingle();
  return data?.is_verified === true;
}
