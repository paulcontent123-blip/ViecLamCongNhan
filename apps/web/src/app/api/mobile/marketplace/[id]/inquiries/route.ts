import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Mã tin không hợp lệ." }, { status: 400 });
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Đăng nhập và xác minh số điện thoại để gửi yêu cầu liên hệ." }, { status: 401 });
  const schema = z.object({ message: z.string().trim().max(1000).optional().default(""), contactConsent: z.literal(true) });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vui lòng đồng ý chia sẻ số điện thoại đã xác minh với người bán." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: listing, error: listingError } = await supabase.from("secondhand_marketplace_listings")
    .select("id,seller_user_id,users!secondhand_marketplace_listings_seller_user_id_fkey!inner(role,status,is_verified)").eq("id", id).eq("moderation_status", "approved").eq("seller_state", "available")
    .eq("users.role", "candidate").eq("users.status", "active").eq("users.is_verified", true)
    .lte("published_at", new Date().toISOString()).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (listingError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/[id]/inquiries", operation: "load_listing_before_inquiry", error: listingError });
    return NextResponse.json({ error: "Chưa xác minh được trạng thái tin.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!listing) return NextResponse.json({ error: "Tin không còn nhận yêu cầu liên hệ." }, { status: 409 });
  if (listing.seller_user_id === session.userId) return NextResponse.json({ error: "Bạn không thể gửi yêu cầu liên hệ cho tin của chính mình." }, { status: 400 });
  const { data: buyer, error: buyerError } = await supabase.from("users").select("full_name,phone")
    .eq("id", session.userId).eq("role", "candidate").eq("status", "active").eq("is_verified", true).maybeSingle();
  if (buyerError || !buyer?.phone) {
    const requestId = buyerError ? logSafeSupabaseError({ route: "/api/mobile/marketplace/[id]/inquiries", operation: "load_verified_buyer", error: buyerError }) : undefined;
    return NextResponse.json({ error: buyerError ? "Chưa xác minh được tài khoản." : "Chưa xác minh được số điện thoại của bạn.", ...(requestId ? { requestId } : {}) }, { status: buyerError ? 503 : 403, ...(requestId ? { headers: { "X-Request-Id": requestId } } : {}) });
  }
  const { data, error } = await supabase.from("secondhand_marketplace_inquiries").insert({
    listing_id: listing.id, seller_user_id: listing.seller_user_id, buyer_user_id: session.userId,
    message: parsed.data.message || null, contact_consent_at: new Date().toISOString(),
  }).select("id,created_at,status").single();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/[id]/inquiries", operation: "create_marketplace_inquiry", error });
    return NextResponse.json({ error: "Chưa gửi được yêu cầu. Kiểm tra mục yêu cầu đã gửi trước khi thử tiếp.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, inquiry: data }, { status: 201 });
}
