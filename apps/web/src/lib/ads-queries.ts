import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AD_PUBLIC_FIELDS, adToday, selectAds, type AdChannel, type AdPlacement, type AdRow, type PublicAd } from "@/lib/ads";

/**
 * Quảng cáo đang chạy cho một vị trí và kênh (và KCN đang xem nếu có). Lỗi đọc trả danh sách rỗng: quảng cáo hỏng không được làm hỏng trang.
 * Lọc vị trí, kênh và ngày ngay ở truy vấn; selectAds lọc tiếp theo KCN và chọn quảng cáo hiển thị.
 */
export async function getRunningAds(options: { placement: AdPlacement; channel: AdChannel; kcnId?: string | null }): Promise<PublicAd[]> {
  try {
    const today = adToday();
    const { data, error } = await createSupabaseAdminClient()
      .from("ads")
      .select(AD_PUBLIC_FIELDS)
      .eq("placement", options.placement)
      .eq("status", "active")
      .lte("starts_on", today)
      .gte("ends_on", today)
      .eq(options.channel === "web" ? "show_on_web" : "show_on_app", true)
      .limit(200);
    if (error) throw error;
    return selectAds((data ?? []) as unknown as AdRow[], { ...options, today });
  } catch (error) {
    console.error("getRunningAds error:", error instanceof Error ? error.message : "unknown");
    return [];
  }
}
