import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const categories = ["vehicle", "home_goods", "electronics", "clothing", "other"] as const;
const conditions = ["new", "like_new", "good", "fair"] as const;
const listingSchema = z.object({
  title: z.string().trim().min(5).max(140),
  description: z.string().trim().min(20).max(5000),
  category: z.enum(categories),
  itemCondition: z.enum(conditions),
  priceVnd: z.number().int().min(0).max(1_000_000_000_000),
  isNegotiable: z.boolean().default(false),
  provinceCode: z.string().trim().max(12).optional().nullable(),
  location: z.string().trim().min(2).max(200),
  shareSellerContact: z.boolean().default(false),
});

function pageParams(params: URLSearchParams) {
  const page = Math.max(1, Math.min(100000, Number(params.get("page")) || 1));
  const pageSize = Math.max(1, Math.min(50, Number(params.get("pageSize")) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const paging = pageParams(params);
  const now = new Date().toISOString();
  const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._()]/g, " ");
  const category = params.get("category") || "";
  if (category && !categories.includes(category as typeof categories[number])) return NextResponse.json({ error: "Danh mục không hợp lệ." }, { status: 400 });
  const province = (params.get("province") || "").trim().slice(0, 12);
  let query = createSupabaseAdminClient().from("secondhand_marketplace_listings")
    .select("id,title,description,category,item_condition,price_vnd,is_negotiable,province_code,location,photo_urls,seller_display_name,published_at,expires_at,created_at,users!secondhand_marketplace_listings_seller_user_id_fkey!inner(role,status,is_verified)", { count: "exact" })
    .eq("moderation_status", "approved").eq("seller_state", "available")
    .eq("users.role", "candidate").eq("users.status", "active").eq("users.is_verified", true)
    .lte("published_at", now).gt("expires_at", now)
    .order("published_at", { ascending: false }).order("id", { ascending: false });
  if (category) query = query.eq("category", category);
  if (province) query = query.eq("province_code", province);
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%`);
  const { data, count, error } = await query.range(paging.offset, paging.offset + paging.pageSize - 1);
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace", operation: "list_public_marketplace", error });
    return NextResponse.json({ error: "Chưa tải được tin Chợ đồ cũ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const total = count || 0;
  const items = (data || []).map(({ users, ...item }) => {
    void users;
    return item;
  });
  return NextResponse.json({ ok: true, items, total, page: paging.page, pageSize: paging.pageSize, hasMore: paging.page * paging.pageSize < total });
}

export async function POST(request: NextRequest) {
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Đăng nhập và xác minh số điện thoại để đăng tin." }, { status: 401 });
  const parsed = listingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Thông tin tin đăng chưa hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: user, error: userError } = await supabase.from("users").select("full_name,phone")
    .eq("id", session.userId).eq("role", "candidate").eq("status", "active").eq("is_verified", true).maybeSingle();
  if (userError || !user) {
    const requestId = userError ? logSafeSupabaseError({ route: "/api/mobile/marketplace", operation: "load_seller_profile", error: userError }) : undefined;
    return NextResponse.json({ error: userError ? "Chưa xác minh được tài khoản người bán." : "Tài khoản không đủ điều kiện đăng tin.", ...(requestId ? { requestId } : {}) }, { status: userError ? 503 : 403, ...(requestId ? { headers: { "X-Request-Id": requestId } } : {}) });
  }
  const input = parsed.data;
  if (input.shareSellerContact && !user.phone) return NextResponse.json({ error: "Tài khoản chưa có số điện thoại đã xác minh để chia sẻ." }, { status: 403 });
  const { data, error } = await supabase.from("secondhand_marketplace_listings").insert({
    seller_user_id: session.userId, seller_display_name: user.full_name || "Công nhân",
    title: input.title, description: input.description, category: input.category,
    item_condition: input.itemCondition, price_vnd: input.priceVnd, is_negotiable: input.isNegotiable,
    province_code: input.provinceCode || null, location: input.location,
    seller_contact_consent_at: input.shareSellerContact ? new Date().toISOString() : null,
    seller_contact_consent_phone_hash: input.shareSellerContact ? createHash("sha256").update(user.phone).digest("hex") : null,
  }).select("id,title,moderation_status,seller_state,photo_urls,updated_at,created_at").single();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace", operation: "create_marketplace_listing", error });
    return NextResponse.json({ error: "Chưa tạo được tin Chợ đồ cũ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, listing: data }, { status: 201 });
}
