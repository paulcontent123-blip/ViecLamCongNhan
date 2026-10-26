import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().max(1000).default(""),
  imageUrl: z.string().url().startsWith("https://").nullable().optional(),
  pointsCost: z.number().int().min(1).max(10000000),
  stockRemaining: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (id && !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Mã quà không hợp lệ." }, { status: 400 });
  let query = createSupabaseAdminClient().from("candidate_reward_catalog")
    .select("id,title,description,image_url,points_cost,stock_remaining,is_active,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (id) query = query.eq("id", id);
  const { data, error } = await query;
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-rewards/catalog", operation: "list_catalog", error });
    return NextResponse.json({ error: "Không tải được danh mục quà.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, items: data || [] });
}

export async function POST(request: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin quà chưa hợp lệ." }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().from("candidate_reward_catalog").insert({
    title: parsed.data.title,
    description: parsed.data.description,
    image_url: parsed.data.imageUrl ?? null,
    points_cost: parsed.data.pointsCost,
    stock_remaining: parsed.data.stockRemaining ?? null,
    is_active: parsed.data.isActive,
  }).select("id,title,description,image_url,points_cost,stock_remaining,is_active,created_at,updated_at").single();
  if (error || !data) {
    const requestId = error ? logSafeSupabaseError({ route: "/api/mobile/admin/candidate-rewards/catalog", operation: "create_catalog_item", error }) : undefined;
    return NextResponse.json({ error: "Không tạo được quà.", ...(requestId ? { requestId } : {}) }, { status: 503, ...(requestId ? { headers: { "X-Request-Id": requestId } } : {}) });
  }
  return NextResponse.json({ ok: true, item: data }, { status: 201 });
}
