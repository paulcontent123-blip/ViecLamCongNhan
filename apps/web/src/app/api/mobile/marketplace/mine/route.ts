import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

export async function GET() {
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { data, error } = await createSupabaseAdminClient().from("secondhand_marketplace_listings")
    .select("id,title,description,category,item_condition,price_vnd,is_negotiable,province_code,location,photo_urls,seller_contact_consent_at,seller_contact_consent_phone_hash,seller_state,moderation_status,rejection_reason,published_at,expires_at,updated_at,created_at")
    .eq("seller_user_id", session.userId).order("created_at", { ascending: false }).limit(100);
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/mine", operation: "list_owned_marketplace_listings", error });
    return NextResponse.json({ error: "Chưa tải được tin của bạn.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const contactConsent = (data || []).some(item => item.seller_contact_consent_at && item.seller_contact_consent_phone_hash);
  let sellerPhone: string | null = null;
  if (contactConsent) {
    const { data: seller, error: sellerError } = await createSupabaseAdminClient().from("users").select("phone")
      .eq("id", session.userId).eq("role", "candidate").maybeSingle();
    if (sellerError) {
      const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/mine", operation: "check_owned_contact_consent_phone", error: sellerError });
      return NextResponse.json({ error: "Chưa xác minh được quyền chia sẻ số điện thoại.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
    }
    sellerPhone = seller?.phone || null;
  }
  return NextResponse.json({ ok: true, items: (data || []).map(({ seller_contact_consent_at, seller_contact_consent_phone_hash, ...item }) => ({
    ...item,
    shareSellerContact: Boolean(sellerPhone && seller_contact_consent_at && seller_contact_consent_phone_hash && createHash("sha256").update(sellerPhone).digest("hex") === seller_contact_consent_phone_hash),
    isExpired: Boolean(item.expires_at && new Date(item.expires_at).getTime() <= Date.now()),
  })) });
}
