import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ServicePackageCardRow } from "@/types/db";

const SERVICE_PACKAGE_CARD_SELECT =
  "id, icon, title, description, features, price, cta_label, accent, sort_order, is_active, created_at, updated_at";

export async function getActiveServicePackageCards(): Promise<ServicePackageCardRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_package_cards")
    .select(SERVICE_PACKAGE_CARD_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getActiveServicePackageCards error:", error.message);
    return [];
  }
  return (data ?? []) as ServicePackageCardRow[];
}
