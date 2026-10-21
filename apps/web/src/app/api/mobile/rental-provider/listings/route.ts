import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRentalProviderSession } from "@/lib/rental-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { isRentalProviderUnverifiedError, rentalListingRow, rentalListingSchema } from "@/lib/rental-provider-listing-utils";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const submitSchema = z.object({ ...rentalListingSchema.shape, action: z.enum(["draft", "submit"]).default("submit") });
export async function GET(request: NextRequest) {
  const session = await getRentalProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  let paging;
  try { paging = parseEmployerListParams(request.nextUrl.searchParams, ["draft", "pending", "approved", "rejected", "hidden", "full"]); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số danh sách không hợp lệ." }, { status: 400 }); }
  const params = request.nextUrl.searchParams;
  const id = params.get("id");
  if (id && !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Mã tin cho thuê không hợp lệ." }, { status: 400 });
  const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._(),]/g, " ");
  let query = createSupabaseAdminClient().from("rental_listings").select("*", { count: "exact" })
    .eq("provider_id", session.providerId).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (paging.status) query = query.eq("status", paging.status);
  if (id) query = query.eq("id", id);
  if (q) query = query.or(`title.ilike.%${q}%,location.ilike.%${q}%`);
  const { data, count, error } = await query.range(paging.offset, paging.offset + paging.pageSize - 1);
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/listings", operation: "list_owned_rental_listings", error });
    return NextResponse.json({ error: "Chưa tải được tin cho thuê.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const total = count || 0;
  return NextResponse.json({ ok: true, items: data || [], total, page: paging.page, pageSize: paging.pageSize, hasMore: paging.page * paging.pageSize < total });
}

export async function POST(request: NextRequest) {
  const session = await getRentalProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const parsed = submitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin tin cho thuê không hợp lệ." }, { status: 400 });
  const { action, ...input } = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data: provider, error: providerError } = await supabase.from("rental_providers").select("is_verified").eq("id", session.providerId).maybeSingle();
  if (providerError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/listings", operation: "check_rental_provider_verification", error: providerError });
    return NextResponse.json({ error: "Chưa xác minh được quyền gửi tin. Vui lòng thử lại.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!provider) return NextResponse.json({ error: "Không tìm thấy hồ sơ đối tác." }, { status: 404 });
  if (action === "submit" && !provider.is_verified) return NextResponse.json({ error: "Đối tác cần được Admin xác minh trước khi gửi tin cho thuê." }, { status: 403 });
  const { data, error } = await supabase.from("rental_listings").insert({
    ...rentalListingRow(input), provider_id: session.providerId, status: action === "submit" ? "pending" : "draft",
  }).select("id,title,status,created_at").single();
  if (error) {
    if (isRentalProviderUnverifiedError(error)) return NextResponse.json({ error: "Đối tác cần được Admin xác minh trước khi gửi tin cho thuê." }, { status: 403 });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/listings", operation: "create_rental_listing", error });
    return NextResponse.json({ error: "Chưa tạo được tin cho thuê.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, listing: data }, { status: 201 });
}
