import { requireAdminPage } from "@/lib/admin-auth";
import { AD_FIELDS, type AdRow } from "@/lib/ads";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdPlacementManagement, type AdminAdItem, type KcnOption } from "@/components/admin/AdPlacementManagement";

// Danh sách đổi ngay sau mỗi thao tác tạo, sửa, xóa.
export const dynamic = "force-dynamic";

// Quản lý quảng cáo hiển thị (banner, sidebar, card). Mọi cấp Admin (Biên tập, Superadmin) vào được, giống app Admin.
export default async function AdminAdPlacementsPage() {
  await requireAdminPage();
  const supabase = createSupabaseAdminClient();
  const [ads, kcn] = await Promise.all([
    supabase.from("ads").select(AD_FIELDS).order("ends_on", { ascending: false }).order("id", { ascending: false }).limit(200),
    supabase.from("kcn").select("id, name, province_name").order("province_name", { ascending: true }).order("name", { ascending: true }),
  ]);
  const kcnOptions: KcnOption[] = ((kcn.data ?? []) as { id: string; name: string; province_name: string }[]).map((row) => ({ id: row.id, label: `${row.name} (${row.province_name})` }));
  const items = ((ads.data ?? []) as unknown as AdRow[]).map((row): AdminAdItem => ({ ...row, customer_note: row.customer_note ?? null }));
  return <AdPlacementManagement ads={items} kcnOptions={kcnOptions} loadError={!!ads.error || !!kcn.error} />;
}
