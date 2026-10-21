import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { data, error } = await createSupabaseAdminClient().from("rental_listings")
    .select("id,title,description,monthly_rent_vnd,area_sqm,province_code,location,room_type,capacity,nearby_industrial_zone,amenities,photo_urls,published_at,created_at,rental_providers!inner(provider_name,is_verified)")
    .eq("id", id).eq("status", "approved").eq("rental_providers.is_verified", true).maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rentals/[id]", operation: "load_public_rental_detail", error });
    return NextResponse.json({ error: "Chưa tải được tin cho thuê.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Tin cho thuê không còn công khai." }, { status: 404 });
  const provider = Array.isArray(data.rental_providers) ? data.rental_providers[0] : data.rental_providers;
  const { rental_providers: _providerRelation, ...listing } = data;
  return NextResponse.json({ ok: true, listing: { ...listing, provider_name: provider?.provider_name } });
}
