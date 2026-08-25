import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AdvertisingPricingCardRow } from "@/types/db";

const ADVERTISING_PRICING_SELECT =
  "id, format, placement, price, unit, cta_label, sort_order, is_active, created_at, updated_at";

export async function getActiveAdvertisingPricingCards(): Promise<AdvertisingPricingCardRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("advertising_pricing_cards")
    .select(ADVERTISING_PRICING_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getActiveAdvertisingPricingCards error:", error.message);
    return [];
  }
  return (data ?? []) as AdvertisingPricingCardRow[];
}
