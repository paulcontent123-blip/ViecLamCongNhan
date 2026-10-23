import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const STATUSES = ["pending", "approved", "rejected"];
export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const status = params.get("status") || "pending";
  if (status !== "all" && !STATUSES.includes(status)) return NextResponse.json({ error: "Trạng thái kiểm duyệt không hợp lệ." }, { status: 400 });
  const page = Math.max(1, Math.min(100000, Number(params.get("page")) || 1));
  const pageSize = Math.max(1, Math.min(50, Number(params.get("pageSize")) || 20));
  const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._()]/g, " ");
  let query = createSupabaseAdminClient().from("secondhand_marketplace_listings")
    .select("id,seller_user_id,seller_display_name,title,description,category,item_condition,price_vnd,is_negotiable,province_code,location,photo_urls,seller_state,moderation_status,rejection_reason,published_at,expires_at,updated_at,created_at", { count: "exact" })
    .order("created_at", { ascending: false }).order("id", { ascending: false });
  if (status !== "all") query = query.eq("moderation_status", status);
  if (q) query = query.or(`title.ilike.%${q}%,seller_display_name.ilike.%${q}%,location.ilike.%${q}%`);
  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/marketplace", operation: "list_marketplace_for_admin", error });
    return NextResponse.json({ error: "Chưa tải được tin Chợ để kiểm duyệt.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const total = count || 0;
  return NextResponse.json({ ok: true, items: data || [], total, page, pageSize, hasMore: page * pageSize < total });
}
