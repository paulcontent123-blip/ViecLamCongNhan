import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const categories = ["vehicle", "home_goods", "electronics", "clothing", "other"] as const;
const conditions = ["new", "like_new", "good", "fair"] as const;
const editSchema = z.object({
  action: z.literal("edit"), expectedUpdatedAt: z.string().datetime({ offset: true }),
  title: z.string().trim().min(5).max(140), description: z.string().trim().min(20).max(5000),
  category: z.enum(categories), itemCondition: z.enum(conditions),
  priceVnd: z.number().int().min(0).max(1_000_000_000_000), isNegotiable: z.boolean(),
  provinceCode: z.string().trim().max(12).optional().nullable(), location: z.string().trim().min(2).max(200),
  shareSellerContact: z.boolean().default(false),
});
const stateSchema = z.object({ action: z.literal("set_state"), expectedUpdatedAt: z.string().datetime({ offset: true }), sellerState: z.enum(["available", "sold", "hidden"]) });

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Mã tin không hợp lệ." }, { status: 400 });
  const session = await getCandidateSession();
  const { data, error } = await createSupabaseAdminClient().from("secondhand_marketplace_listings")
    .select("id,title,description,category,item_condition,price_vnd,is_negotiable,province_code,location,photo_urls,seller_display_name,seller_user_id,seller_contact_consent_at,seller_contact_consent_phone_hash,seller_state,moderation_status,rejection_reason,published_at,expires_at,updated_at,created_at,users!secondhand_marketplace_listings_seller_user_id_fkey!inner(role,status,is_verified)")
    .eq("id", id).maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/[id]", operation: "load_marketplace_listing", error });
    return NextResponse.json({ error: "Chưa tải được chi tiết tin.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const isOwner = Boolean(session && data?.seller_user_id === session.userId);
  const seller = Array.isArray(data?.users) ? data.users[0] : data?.users;
  const activeVerifiedSeller = seller?.role === "candidate" && seller?.status === "active" && seller?.is_verified === true;
  if (!activeVerifiedSeller) return NextResponse.json({ error: "Tin không còn công khai." }, { status: 404 });
  if (!data || (!isOwner && (data.moderation_status !== "approved" || data.seller_state !== "available" || !data.expires_at || new Date(data.expires_at) <= new Date() || !data.published_at || new Date(data.published_at) > new Date()))) return NextResponse.json({ error: "Tin không còn công khai." }, { status: 404 });
  let ownerShareSellerContact = false;
  const supabase = createSupabaseAdminClient();
  if (isOwner && data.seller_contact_consent_at && data.seller_contact_consent_phone_hash) {
    const { data: owner, error: ownerError } = await supabase.from("users").select("phone")
      .eq("id", data.seller_user_id).eq("role", "candidate").eq("status", "active").eq("is_verified", true).maybeSingle();
    if (ownerError) {
      const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/[id]", operation: "check_owner_contact_consent_phone", error: ownerError });
      return NextResponse.json({ error: "Chưa xác minh được quyền chia sẻ số điện thoại.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
    }
    ownerShareSellerContact = Boolean(owner?.phone && createHash("sha256").update(owner.phone).digest("hex") === data.seller_contact_consent_phone_hash);
  }
  const { seller_user_id: _sellerUserId, seller_contact_consent_at: _sellerContactConsentAt, seller_contact_consent_phone_hash: _sellerContactConsentPhoneHash, users: _seller, ...listing } = data;
  void _sellerUserId;
  void _sellerContactConsentAt;
  void _sellerContactConsentPhoneHash;
  void _seller;
  let hasContactRequest = false;
  let sellerPhone: string | null = null;
  if (session && !isOwner) {
    const { data: inquiry, error: inquiryError } = await supabase.from("secondhand_marketplace_inquiries")
      .select("id").eq("listing_id", id).eq("buyer_user_id", session.userId).not("contact_consent_at", "is", null).limit(1).maybeSingle();
    if (inquiryError) {
      const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/[id]", operation: "check_marketplace_contact_consent", error: inquiryError });
      return NextResponse.json({ error: "Chưa xác minh được quyền xem thông tin người bán.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
    }
    hasContactRequest = Boolean(inquiry);
    if (hasContactRequest && data.seller_contact_consent_at && data.seller_contact_consent_phone_hash) {
      const { data: buyer, error: buyerError } = await supabase.from("users").select("id")
        .eq("id", session.userId).eq("role", "candidate").eq("status", "active").eq("is_verified", true).maybeSingle();
      if (buyerError) {
        const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/[id]", operation: "verify_buyer_for_seller_contact", error: buyerError });
        return NextResponse.json({ error: "Chưa xác minh được quyền xem thông tin người bán.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
      }
      const { data: sellerContact, error: sellerContactError } = buyer
        ? await supabase.from("users").select("phone").eq("id", data.seller_user_id).eq("role", "candidate").eq("status", "active").eq("is_verified", true).maybeSingle()
        : { data: null, error: null };
      if (sellerContactError) {
        const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/[id]", operation: "load_consented_seller_contact", error: sellerContactError });
        return NextResponse.json({ error: "Chưa tải được thông tin liên hệ người bán.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
      }
      if (sellerContact?.phone && createHash("sha256").update(sellerContact.phone).digest("hex") === data.seller_contact_consent_phone_hash) sellerPhone = sellerContact.phone;
    }
  }
  const ownerListing = isOwner ? { shareSellerContact: ownerShareSellerContact } : {};
  return NextResponse.json({ ok: true, isOwner, hasContactRequest, ...(sellerPhone ? { sellerPhone } : {}), listing: { ...listing, ...ownerListing, isExpired: Boolean(data.expires_at && new Date(data.expires_at) <= new Date()) } });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Mã tin không hợp lệ." }, { status: 400 });
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = z.discriminatedUnion("action", [editSchema, stateSchema]).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Thông tin cập nhật chưa hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  let sellerPhone: string | null = null;
  if (parsed.data.action === "edit" && parsed.data.shareSellerContact) {
    const { data: seller, error: sellerError } = await supabase.from("users").select("phone")
      .eq("id", session.userId).eq("role", "candidate").eq("status", "active").eq("is_verified", true).maybeSingle();
    if (sellerError) {
      const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/[id]", operation: "load_verified_seller_for_contact_consent", error: sellerError });
      return NextResponse.json({ error: "Chưa xác minh được số điện thoại để chia sẻ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
    }
    if (!seller?.phone) return NextResponse.json({ error: "Tài khoản chưa có số điện thoại đã xác minh để chia sẻ." }, { status: 403 });
    sellerPhone = seller.phone;
  }
  const { data: current, error: loadError } = await supabase.from("secondhand_marketplace_listings")
    .select("id,moderation_status,seller_state,expires_at,updated_at").eq("id", id).eq("seller_user_id", session.userId).maybeSingle();
  if (loadError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/[id]", operation: "load_owned_marketplace_listing", error: loadError });
    return NextResponse.json({ error: "Chưa xác minh được tin để cập nhật.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!current) return NextResponse.json({ error: "Không tìm thấy tin của bạn." }, { status: 404 });
  if (current.updated_at !== parsed.data.expectedUpdatedAt) return NextResponse.json({ error: "Tin đã thay đổi ở nơi khác. Tải lại trước khi cập nhật." }, { status: 409 });
  if (current.expires_at && new Date(current.expires_at) <= new Date()) return NextResponse.json({ error: "Tin đã hết hiệu lực sau 30 ngày." }, { status: 409 });
  let updates: Record<string, unknown>;
  if (parsed.data.action === "edit") {
    const input = parsed.data;
    updates = { title: input.title, description: input.description, category: input.category, item_condition: input.itemCondition, price_vnd: input.priceVnd, is_negotiable: input.isNegotiable, province_code: input.provinceCode || null, location: input.location, seller_contact_consent_at: sellerPhone ? new Date().toISOString() : null, seller_contact_consent_phone_hash: sellerPhone ? createHash("sha256").update(sellerPhone).digest("hex") : null, moderation_status: "pending", rejection_reason: null, published_at: null, expires_at: null, updated_at: new Date().toISOString() };
  } else {
    if (current.moderation_status !== "approved") return NextResponse.json({ error: "Chỉ tin đã duyệt mới đổi được trạng thái còn hàng, đã bán hoặc ẩn." }, { status: 409 });
    updates = { seller_state: parsed.data.sellerState, updated_at: new Date().toISOString() };
  }
  const { data, error } = await supabase.from("secondhand_marketplace_listings").update(updates).eq("id", id)
    .eq("seller_user_id", session.userId).eq("updated_at", parsed.data.expectedUpdatedAt)
    .select("id,title,seller_state,moderation_status,rejection_reason,photo_urls,seller_contact_consent_at,published_at,expires_at,updated_at").maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/[id]", operation: parsed.data.action === "edit" ? "edit_marketplace_listing" : "set_marketplace_listing_state", error });
    return NextResponse.json({ error: "Chưa cập nhật được tin. Tải lại để kiểm tra trước khi thử tiếp.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Tin đã thay đổi ở nơi khác. Tải lại trước khi cập nhật." }, { status: 409 });
  return NextResponse.json({ ok: true, listing: { ...data, shareSellerContact: Boolean(data.seller_contact_consent_at) } });
}
