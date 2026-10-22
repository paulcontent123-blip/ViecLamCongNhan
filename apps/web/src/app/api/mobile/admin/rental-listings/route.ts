import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

type ProviderRelation = { provider_name: string; is_verified: boolean } | Array<{ provider_name: string; is_verified: boolean }> | null;
export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  let paging;
  try { paging = parseEmployerListParams(request.nextUrl.searchParams, ["draft", "pending", "approved", "rejected", "hidden", "full"]); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số danh sách không hợp lệ." }, { status: 400 }); }
  const params = request.nextUrl.searchParams;
  const id = params.get("id");
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã tin cho thuê không hợp lệ." }, { status: 400 });
  const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._(),]/g, " ");
  let query = createSupabaseAdminClient().from("rental_listings")
    .select("id,provider_id,title,description,monthly_rent_vnd,province_code,location,status,rejection_reason,photo_urls,created_at,rental_providers!inner(provider_name,is_verified)", { count: "exact" })
    .order("created_at", { ascending: false }).order("id", { ascending: false });
  if (paging.status) query = query.eq("status", paging.status);
  if (id) query = query.eq("id", id);
  if (q) query = query.or(`title.ilike.%${q}%,location.ilike.%${q}%`);
  const { data, count, error } = await query.range(paging.offset, paging.offset + paging.pageSize - 1);
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/rental-listings", operation: "list_rental_listings_for_review", error });
    return NextResponse.json({ error: "Chưa tải được tin cho thuê để kiểm duyệt.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const items = (data || []).map(({ rental_providers, ...listing }) => {
    const provider = rental_providers as ProviderRelation;
    const row = Array.isArray(provider) ? provider[0] : provider;
    return { ...listing, provider_name: row?.provider_name, provider_verified: row?.is_verified };
  });
  const total = count || 0;
  return NextResponse.json({ ok: true, items, total, page: paging.page, pageSize: paging.pageSize, hasMore: paging.page * paging.pageSize < total });
}
