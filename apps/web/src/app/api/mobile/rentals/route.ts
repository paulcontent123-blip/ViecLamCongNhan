import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

type RentalProviderRelation = { provider_name: string; is_verified: boolean } | Array<{ provider_name: string; is_verified: boolean }> | null;
type PublicRentalRow = Record<string, unknown> & { rental_providers: RentalProviderRelation };

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let paging;
  try { paging = parseEmployerListParams(params, []); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số danh sách không hợp lệ." }, { status: 400 }); }
  const province = (params.get("province") || "").trim().slice(0, 32);
  const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._(),]/g, " ");
  const minRent = Number(params.get("minRent") || 0);
  const maxRentRaw = params.get("maxRent");
  const maxRent = maxRentRaw ? Number(maxRentRaw) : null;
  if (!Number.isSafeInteger(minRent) || minRent < 0 || (maxRent !== null && (!Number.isSafeInteger(maxRent) || maxRent < minRent))) {
    return NextResponse.json({ error: "Khoảng giá thuê không hợp lệ." }, { status: 400 });
  }
  let query = createSupabaseAdminClient().from("rental_listings")
    .select("id,title,description,monthly_rent_vnd,area_sqm,province_code,location,room_type,capacity,nearby_industrial_zone,amenities,photo_urls,published_at,created_at,rental_providers!inner(provider_name,is_verified)", { count: "exact" })
    .eq("status", "approved").eq("rental_providers.is_verified", true).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (province) query = query.eq("province_code", province);
  if (minRent) query = query.gte("monthly_rent_vnd", minRent);
  if (maxRent !== null) query = query.lte("monthly_rent_vnd", maxRent);
  if (q) query = query.or(`title.ilike.%${q}%,location.ilike.%${q}%,nearby_industrial_zone.ilike.%${q}%`);
  const { data, count, error } = await query.range(paging.offset, paging.offset + paging.pageSize - 1);
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rentals", operation: "list_public_rentals", error });
    return NextResponse.json({ error: "Chưa tải được danh sách phòng trọ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const items = ((data || []) as unknown as PublicRentalRow[]).map(({ rental_providers, ...listing }) => ({
    ...listing,
    provider_name: Array.isArray(rental_providers) ? rental_providers[0]?.provider_name : rental_providers?.provider_name,
  }));
  const total = count || 0;
  return NextResponse.json({ ok: true, items, total, page: paging.page, pageSize: paging.pageSize, hasMore: paging.page * paging.pageSize < total });
}
