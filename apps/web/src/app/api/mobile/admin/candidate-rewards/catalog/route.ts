import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const rewardTypeFields = {
  rewardType: z.enum(["gift_card", "cash", "physical"]).default("physical"),
  valueVnd: z.number().int().min(1).max(1000000000).nullable().optional(),
  brand: z.string().trim().min(1).max(80).nullable().optional(),
  isService: z.boolean().default(false),
};

const schema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().max(1000).default(""),
  imageUrl: z.string().url().startsWith("https://").nullable().optional(),
  pointsCost: z.number().int().min(1).max(10000000),
  stockRemaining: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().default(false),
  ...rewardTypeFields,
}).superRefine((value, ctx) => {
  if (value.rewardType === "gift_card" && !value.brand) ctx.addIssue({ code: "custom", path: ["brand"], message: "Thẻ quà cần có thương hiệu." });
  if (["gift_card", "cash"].includes(value.rewardType) && !value.valueVnd) ctx.addIssue({ code: "custom", path: ["valueVnd"], message: "Cần nhập mệnh giá hoặc số tiền." });
});

export async function GET(request: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (id && !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Mã quà không hợp lệ." }, { status: 400 });
  let query = createSupabaseAdminClient().from("candidate_reward_catalog")
    .select("id,title,description,image_url,points_cost,stock_remaining,is_active,reward_type,value_vnd,brand,is_service,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (id) query = query.eq("id", id);
  const { data, error } = await query;
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-rewards/catalog", operation: "list_catalog", error });
    return NextResponse.json({ error: "Không tải được danh mục quà.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const items = data || [];
  // Số yêu cầu chờ/đã duyệt của từng quà: app dùng để khóa đổi loại khi còn yêu cầu đang xử lý.
  const openCounts: Record<string, number> = {};
  if (items.length) {
    const { data: open, error: openError } = await createSupabaseAdminClient().from("candidate_reward_redemptions")
      .select("reward_id").in("reward_id", items.map(item => item.id)).in("status", ["pending", "approved"]);
    if (openError) {
      const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-rewards/catalog", operation: "count_open_redemptions", error: openError });
      return NextResponse.json({ error: "Không tải được danh mục quà.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
    }
    for (const row of open || []) openCounts[row.reward_id] = (openCounts[row.reward_id] || 0) + 1;
  }
  return NextResponse.json({ ok: true, items: items.map(item => ({ ...item, open_request_count: openCounts[item.id] || 0 })) });
}

export async function POST(request: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Thông tin quà chưa hợp lệ." }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().from("candidate_reward_catalog").insert({
    title: parsed.data.title,
    description: parsed.data.description,
    image_url: parsed.data.imageUrl ?? null,
    points_cost: parsed.data.pointsCost,
    stock_remaining: parsed.data.stockRemaining ?? null,
    is_active: parsed.data.isActive,
    reward_type: parsed.data.rewardType,
    value_vnd: parsed.data.rewardType === "physical" ? null : parsed.data.valueVnd ?? null,
    brand: parsed.data.rewardType === "gift_card" ? parsed.data.brand ?? null : null,
    is_service: parsed.data.rewardType === "physical" ? parsed.data.isService : false,
  }).select("id,title,description,image_url,points_cost,stock_remaining,is_active,reward_type,value_vnd,brand,is_service,created_at,updated_at").single();
  if (error || !data) {
    const requestId = error ? logSafeSupabaseError({ route: "/api/mobile/admin/candidate-rewards/catalog", operation: "create_catalog_item", error }) : undefined;
    return NextResponse.json({ error: "Không tạo được quà.", ...(requestId ? { requestId } : {}) }, { status: 503, ...(requestId ? { headers: { "X-Request-Id": requestId } } : {}) });
  }
  return NextResponse.json({ ok: true, item: data }, { status: 201 });
}
