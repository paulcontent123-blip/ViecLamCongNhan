import { createSupabaseServerClient } from "@/lib/supabase/server";

// Nội dung công khai của các trang "Quảng cáo/Hợp tác" và "Dịch vụ trọn gói" cho app.
// Khác các hàm getActive* dùng cho trang web (lỗi trả danh sách rỗng), ở đây lỗi được ném ra
// để app báo "không tải được" thay vì hiển thị như chưa có nội dung.
const AD_CARD_SELECT = "id, icon, icon_bg, title, category, tag, tag_tone, description, package_lines, cta_label, sort_order";
const PRICING_SELECT = "id, format, placement, price, unit, cta_label, sort_order";
const PACKAGE_SELECT = "id, icon, title, description, features, price, cta_label, accent, sort_order";

export async function getMobileAdvertising() {
  const client = await createSupabaseServerClient();
  const [kcn, partners, pricing] = await Promise.all([
    client.from("kcn_ad_cards").select(AD_CARD_SELECT).eq("is_active", true).order("sort_order", { ascending: true }),
    client.from("service_partner_cards").select(AD_CARD_SELECT).eq("is_active", true).order("sort_order", { ascending: true }),
    client.from("advertising_pricing_cards").select(PRICING_SELECT).eq("is_active", true).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
  ]);
  const error = kcn.error || partners.error || pricing.error;
  if (error) throw error;
  return { kcn: kcn.data ?? [], partners: partners.data ?? [], pricing: pricing.data ?? [] };
}

export async function getMobileServicePackages() {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.from("service_package_cards").select(PACKAGE_SELECT).eq("is_active", true).order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
