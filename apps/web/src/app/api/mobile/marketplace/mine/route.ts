import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

export async function GET() {
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { data, error } = await createSupabaseAdminClient().from("secondhand_marketplace_listings")
    .select("id,title,description,category,item_condition,price_vnd,is_negotiable,province_code,location,photo_urls,seller_state,moderation_status,rejection_reason,published_at,expires_at,updated_at,created_at")
    .eq("seller_user_id", session.userId).order("created_at", { ascending: false }).limit(100);
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/mine", operation: "list_owned_marketplace_listings", error });
    return NextResponse.json({ error: "Chưa tải được tin của bạn.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, items: (data || []).map(item => ({ ...item, isExpired: Boolean(item.expires_at && new Date(item.expires_at).getTime() <= Date.now()) })) });
}
