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
  rewardType: z.enum(["gift_card", "cash", "physical"]).optional(),
  valueVnd: z.number().int().min(1).max(1000000000).nullable().optional(),
  brand: z.string().trim().min(1).max(80).nullable().optional(),
  isService: z.boolean().optional(),
}).refine(value => Object.keys(value).length > 0, { message: "Không có trường cần cập nhật." })
  .superRefine((value, ctx) => {
    // Đổi loại quà phải gửi đủ trường của loại mới; thay đổi khác không đụng tới loại thì giữ nguyên.
    if (value.rewardType === "gift_card" && !value.brand) ctx.addIssue({ code: "custom", path: ["brand"], message: "Thẻ quà cần có thương hiệu." });
    if (value.rewardType && ["gift_card", "cash"].includes(value.rewardType) && !value.valueVnd) ctx.addIssue({ code: "custom", path: ["valueVnd"], message: "Cần nhập mệnh giá hoặc số tiền." });
  });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Mã quà không hợp lệ." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Thông tin quà chưa hợp lệ." }, { status: 400 });
  const values = parsed.data;
  const supabase = createSupabaseAdminClient();
  const typeFieldsSent = values.rewardType !== undefined || values.valueVnd !== undefined || values.brand !== undefined || values.isService !== undefined;
  if (typeFieldsSent) {
    const { data: current, error: currentError } = await supabase.from("candidate_reward_catalog")
      .select("reward_type,value_vnd,brand,is_service").eq("id", id).maybeSingle();
    if (currentError) {
      const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-rewards/catalog/[id]", operation: "read_catalog_item", error: currentError });
      return NextResponse.json({ error: "Không cập nhật được quà.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
    }
    if (!current) return NextResponse.json({ error: "Không tìm thấy quà." }, { status: 404 });
    const nextType = values.rewardType ?? current.reward_type;
    const next = {
      value: nextType === "physical" ? null : (values.valueVnd !== undefined ? values.valueVnd : current.value_vnd) ?? null,
      brand: nextType === "gift_card" ? (values.brand !== undefined ? values.brand : current.brand) ?? null : null,
      service: nextType === "physical" ? (values.isService !== undefined ? values.isService : current.is_service) : false,
    };
    const changed = nextType !== current.reward_type || next.value !== (current.value_vnd ?? null) || next.brand !== (current.brand ?? null) || next.service !== current.is_service;
    if (changed) {
      const { count, error: countError } = await supabase.from("candidate_reward_redemptions")
        .select("id", { count: "exact", head: true }).eq("reward_id", id).in("status", ["pending", "approved"]);
      if (countError) {
        const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-rewards/catalog/[id]", operation: "count_open_redemptions", error: countError });
        return NextResponse.json({ error: "Không cập nhật được quà.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
      }
      if ((count || 0) > 0) return NextResponse.json({ error: `Còn ${count} yêu cầu đang xử lý. Hãy xử lý xong các yêu cầu này, hoặc ẩn quà và tạo quà mới với loại mong muốn.`, openRequestCount: count }, { status: 409 });
    }
  }
  const update = {
    ...(values.title !== undefined ? { title: values.title } : {}),
    ...(values.description !== undefined ? { description: values.description } : {}),
    ...(values.imageUrl !== undefined ? { image_url: values.imageUrl } : {}),
    ...(values.pointsCost !== undefined ? { points_cost: values.pointsCost } : {}),
    ...(values.stockRemaining !== undefined ? { stock_remaining: values.stockRemaining } : {}),
    ...(values.isActive !== undefined ? { is_active: values.isActive } : {}),
    ...(values.rewardType !== undefined ? {
      reward_type: values.rewardType,
      value_vnd: values.rewardType === "physical" ? null : values.valueVnd ?? null,
      brand: values.rewardType === "gift_card" ? values.brand ?? null : null,
      is_service: values.rewardType === "physical" ? values.isService ?? false : false,
    } : {
      ...(values.valueVnd !== undefined ? { value_vnd: values.valueVnd } : {}),
      ...(values.brand !== undefined ? { brand: values.brand } : {}),
      ...(values.isService !== undefined ? { is_service: values.isService } : {}),
    }),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("candidate_reward_catalog")
    .update(update).eq("id", id)
    .select("id,title,description,image_url,points_cost,stock_remaining,is_active,reward_type,value_vnd,brand,is_service,created_at,updated_at").maybeSingle();
  if (error?.code === "23514") return NextResponse.json({ error: "Thông tin loại quà chưa đủ: thẻ quà cần thương hiệu và mệnh giá, tiền mặt cần số tiền." }, { status: 400 });
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-rewards/catalog/[id]", operation: "update_catalog_item", error });
    return NextResponse.json({ error: "Không cập nhật được quà.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Không tìm thấy quà." }, { status: 404 });
  return NextResponse.json({ ok: true, item: data });
}
