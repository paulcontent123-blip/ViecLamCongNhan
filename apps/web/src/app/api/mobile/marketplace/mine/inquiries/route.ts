import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

export async function GET() {
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("secondhand_marketplace_inquiries")
    .select("id,listing_id,buyer_user_id,message,status,created_at")
    .eq("seller_user_id", session.userId).order("created_at", { ascending: false }).limit(100);
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/mine/inquiries", operation: "list_marketplace_inquiries", error });
    return NextResponse.json({ error: "Chưa tải được yêu cầu mua.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data?.length) return NextResponse.json({ ok: true, items: [] });
  const buyerIds = [...new Set(data.map(row => row.buyer_user_id))];
  const listingIds = [...new Set(data.map(row => row.listing_id))];
  const [buyers, listings] = await Promise.all([
    supabase.from("users").select("id,full_name,phone").in("id", buyerIds).eq("role", "candidate").eq("status", "active").eq("is_verified", true),
    supabase.from("secondhand_marketplace_listings").select("id,title").in("id", listingIds),
  ]);
  if (buyers.error || listings.error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/mine/inquiries", operation: "load_marketplace_inquiry_contacts", error: buyers.error || listings.error });
    return NextResponse.json({ error: "Chưa xác minh được thông tin người mua.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const buyerById = new Map((buyers.data || []).map(buyer => [buyer.id, buyer]));
  const listingById = new Map((listings.data || []).map(listing => [listing.id, listing]));
  const items = data.flatMap(inquiry => {
    const buyer = buyerById.get(inquiry.buyer_user_id);
    if (!buyer?.phone) return [];
    return [{ ...inquiry, buyer_name: buyer.full_name || "Công nhân", buyer_phone: buyer.phone, listingTitle: listingById.get(inquiry.listing_id)?.title || "Tin Chợ đồ cũ" }];
  });
  return NextResponse.json({ ok: true, items });
}
