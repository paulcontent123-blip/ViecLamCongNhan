import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().startsWith("https://").nullable().optional(),
  pointsCost: z.number().int().min(1).max(10000000).optional(),
  stockRemaining: z.number().int().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
}).refine(value => Object.keys(value).length > 0, { message: "Không có trường cần cập nhật." });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Mã quà không hợp lệ." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin quà chưa hợp lệ." }, { status: 400 });
  const values = parsed.data;
  const update = {
    ...(values.title !== undefined ? { title: values.title } : {}),
    ...(values.description !== undefined ? { description: values.description } : {}),
    ...(values.imageUrl !== undefined ? { image_url: values.imageUrl } : {}),
    ...(values.pointsCost !== undefined ? { points_cost: values.pointsCost } : {}),
    ...(values.stockRemaining !== undefined ? { stock_remaining: values.stockRemaining } : {}),
    ...(values.isActive !== undefined ? { is_active: values.isActive } : {}),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await createSupabaseAdminClient().from("candidate_reward_catalog")
    .update(update).eq("id", id)
    .select("id,title,description,image_url,points_cost,stock_remaining,is_active,created_at,updated_at").maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-rewards/catalog/[id]", operation: "update_catalog_item", error });
    return NextResponse.json({ error: "Không cập nhật được quà.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Không tìm thấy quà." }, { status: 404 });
  return NextResponse.json({ ok: true, item: data });
}
