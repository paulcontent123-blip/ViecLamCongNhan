import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({ status: z.enum(["approved", "rejected", "hidden"]), rejectionReason: z.string().trim().max(500).optional() });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.status === "rejected" && !parsed.data.rejectionReason)) return NextResponse.json({ error: "Khi từ chối cần ghi lý do." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: listing, error: listingError } = await supabase.from("rental_listings").select("id,provider_id").eq("id", id).maybeSingle();
  if (listingError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/rental-listings/[id]", operation: "load_rental_listing_before_review", error: listingError });
    return NextResponse.json({ error: "Chưa tải được tin cho thuê để duyệt.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!listing) return NextResponse.json({ error: "Không tìm thấy tin cho thuê." }, { status: 404 });
  if (parsed.data.status === "approved") {
    const { data: provider, error: providerError } = await supabase.from("rental_providers").select("is_verified").eq("id", listing.provider_id).maybeSingle();
    if (providerError) {
      const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/rental-listings/[id]", operation: "verify_rental_provider_before_approval", error: providerError });
      return NextResponse.json({ error: "Chưa xác minh được đối tác. Chưa thể duyệt tin.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
    }
    if (!provider?.is_verified) return NextResponse.json({ error: "Cần xác minh đối tác trước khi duyệt tin cho thuê." }, { status: 409 });
  }
  const { data, error } = await supabase.from("rental_listings").update({
    status: parsed.data.status,
    rejection_reason: parsed.data.status === "rejected" ? parsed.data.rejectionReason : null,
    published_at: parsed.data.status === "approved" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).select("id,title,status,rejection_reason,published_at").maybeSingle();
  if (error) {
    if (parsed.data.status === "approved" && error.message.includes("RENTAL_PROVIDER_UNVERIFIED")) return NextResponse.json({ error: "Cần xác minh đối tác trước khi duyệt tin cho thuê." }, { status: 409 });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/rental-listings/[id]", operation: "review_rental_listing", error });
    return NextResponse.json({ error: "Chưa cập nhật được trạng thái tin cho thuê.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Không tìm thấy tin cho thuê." }, { status: 404 });
  return NextResponse.json({ ok: true, listing: data });
}
