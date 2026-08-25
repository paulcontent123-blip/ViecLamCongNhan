import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ServicePartnerCardRow } from "@/types/db";

const SERVICE_PARTNER_CARD_SELECT =
  "id, icon, icon_bg, title, category, tag, tag_tone, description, package_lines, cta_label, sort_order, is_active, created_at, updated_at";

export async function getActiveServicePartnerCards(): Promise<ServicePartnerCardRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("service_partner_cards")
    .select(SERVICE_PARTNER_CARD_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getActiveServicePartnerCards error:", error.message);
    return [];
  }
  return (data ?? []) as ServicePartnerCardRow[];
}
