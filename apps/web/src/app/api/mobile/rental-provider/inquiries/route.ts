import { NextRequest, NextResponse } from "next/server";
import { getRentalProviderSession } from "@/lib/rental-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

export async function GET(request: NextRequest) {
  const session = await getRentalProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  let paging;
  try { paging = parseEmployerListParams(request.nextUrl.searchParams, ["new", "contacted", "resolved", "cancelled"]); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số danh sách không hợp lệ." }, { status: 400 }); }
  const id = request.nextUrl.searchParams.get("id");
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã yêu cầu không hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("rental_inquiries")
    .select("id,listing_id,full_name,message,status,created_at,updated_at,rental_listings!inner(title,location)", { count: "exact" })
    .eq("provider_id", session.providerId).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (paging.status) query = query.eq("status", paging.status);
  if (id) query = query.eq("id", id);
  const [result, providerResult] = await Promise.all([
    query.range(paging.offset, paging.offset + paging.pageSize - 1),
    supabase.from("rental_providers").select("is_verified,contact_view_limit").eq("id", session.providerId).maybeSingle(),
  ]);
  if (result.error || providerResult.error) {
    const error = result.error || providerResult.error!;
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/inquiries", operation: "list_rental_inquiries", error });
    return NextResponse.json({ error: "Chưa tải được yêu cầu thuê trọ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const now = new Date();
  const periodStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const pageInquiryIds = (result.data || []).map((item) => item.id);
  const [usageResult, pageViewsResult] = await Promise.all([
    supabase.from("rental_provider_contact_views").select("inquiry_id", { count: "exact", head: true })
      .eq("provider_id", session.providerId).eq("period_start", periodStart),
    pageInquiryIds.length
      ? supabase.from("rental_provider_contact_views").select("inquiry_id")
        .eq("provider_id", session.providerId).eq("period_start", periodStart).in("inquiry_id", pageInquiryIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (usageResult.error || pageViewsResult.error) {
    const error = usageResult.error || pageViewsResult.error!;
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/inquiries", operation: "load_rental_contact_views", error });
    return NextResponse.json({ error: "Chưa tải được hạn mức xem liên hệ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const viewedIds = new Set((pageViewsResult.data || []).map((row) => row.inquiry_id));
  const items = (result.data || []).map(({ rental_listings, ...inquiry }) => {
    const listing = Array.isArray(rental_listings) ? rental_listings[0] : rental_listings;
    return { ...inquiry, listing_title: listing?.title, location: listing?.location, has_contact: true, has_viewed_this_period: viewedIds.has(inquiry.id) };
  });
  const total = result.count || 0;
  return NextResponse.json({
    ok: true, items, total, page: paging.page, pageSize: paging.pageSize, hasMore: paging.page * paging.pageSize < total,
    usage: { verified: Boolean(providerResult.data?.is_verified), viewedCount: usageResult.count || 0, viewLimit: providerResult.data?.contact_view_limit || 0 },
  });
}
