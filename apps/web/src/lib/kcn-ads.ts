import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { KcnAdCardRow } from "@/types/db";

const KCN_AD_CARD_SELECT =
  "id, icon, icon_bg, title, category, tag, tag_tone, description, package_lines, cta_label, sort_order, is_active, created_at, updated_at";

export async function getActiveKcnAdCards(): Promise<KcnAdCardRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("kcn_ad_cards")
    .select(KCN_AD_CARD_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("getActiveKcnAdCards error:", error.message);
    return [];
  }
  return (data ?? []) as KcnAdCardRow[];
}
