import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

export async function GET(request: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const querySchema = z.object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(["pending", "approved", "rejected", "fulfilled", "all"]).default("all"),
    id: z.string().uuid().optional(),
  });
  const parsed = querySchema.safeParse({
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
    status: params.get("status") ?? undefined,
    id: params.get("id") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Bộ lọc yêu cầu đổi quà không hợp lệ." }, { status: 400 });
  const { page, pageSize, status, id } = parsed.data;
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("candidate_reward_redemptions")
    .select("id,user_id,reward_id,reward_title_snapshot,points_cost,status,reward_type_snapshot,reward_value_vnd_snapshot,reward_brand_snapshot,reward_is_service_snapshot,delivery_info,fulfillment_info,admin_note,processed_at,created_at,updated_at,users!candidate_reward_redemptions_user_id_fkey(full_name,phone)", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (status !== "all") query = query.eq("status", status);
  if (id) query = query.eq("id", id);
  const { data, error, count } = await query;
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-reward-redemptions", operation: "list_redemptions", error });
    return NextResponse.json({ error: "Không tải được yêu cầu đổi quà.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const items = data || [];
  // Quà tiền mặt: tổng tiền người này đã đổi trong tháng này (giờ Việt Nam, gồm cả yêu cầu đang xem) để Admin theo dõi.
  const cashUserIds = [...new Set(items.filter(item => item.reward_type_snapshot === "cash").map(item => item.user_id))];
  const monthTotals: Record<string, number> = {};
  let alertVnd: number | null = null;
  if (cashUserIds.length) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(new Date());
    const monthStart = `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}-01T00:00:00+07:00`;
    const [{ data: cash, error: cashError }, { data: settings }] = await Promise.all([
      supabase.from("candidate_reward_redemptions").select("user_id,reward_value_vnd_snapshot")
        .in("user_id", cashUserIds).eq("reward_type_snapshot", "cash").in("status", ["pending", "approved", "fulfilled"]).gte("created_at", monthStart),
      supabase.from("candidate_reward_settings").select("cash_monthly_alert_vnd").eq("id", true).maybeSingle(),
    ]);
    if (cashError) {
      const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-reward-redemptions", operation: "sum_cash_month", error: cashError });
      return NextResponse.json({ error: "Không tải được yêu cầu đổi quà.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
    }
    for (const row of cash || []) monthTotals[row.user_id] = (monthTotals[row.user_id] || 0) + (row.reward_value_vnd_snapshot || 0);
    alertVnd = settings?.cash_monthly_alert_vnd ?? null;
  }
  const decorated = items.map(item => {
    if (item.reward_type_snapshot !== "cash") return item;
    const total = monthTotals[item.user_id] || 0;
    return { ...item, cash_month_total_vnd: total, cash_month_over_alert: alertVnd !== null && total > alertVnd };
  });
  return NextResponse.json({ ok: true, items: decorated, total: count || 0, page, pageSize, hasMore: page * pageSize < (count || 0) });
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const bodySchema = z.object({
    id: z.string().uuid(),
    expectedStatus: z.enum(["pending", "approved"]),
    status: z.enum(["approved", "rejected", "fulfilled"]),
    adminNote: z.string().trim().max(1000).optional(),
    fulfillmentInfo: z.object({
      voucherCode: z.string().trim().max(200).optional(),
      transferReference: z.string().trim().max(200).optional(),
      note: z.string().trim().max(300).optional(),
    }).optional(),
  }).superRefine((value, ctx) => {
    const valid = value.expectedStatus === "pending"
      ? ["approved", "rejected"].includes(value.status)
      : value.status === "fulfilled";
    if (!valid) ctx.addIssue({ code: "custom", path: ["status"], message: "Trạng thái kế tiếp không hợp lệ." });
  });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin xử lý yêu cầu chưa hợp lệ." }, { status: 400 });
  const body = parsed.data;
  const { data, error } = await createSupabaseAdminClient().rpc("process_candidate_reward_redemption", {
    p_redemption_id: body.id,
    p_admin_id: admin.userId,
    p_expected_status: body.expectedStatus,
    p_next_status: body.status,
    p_admin_note: body.adminNote?.trim() || null,
    p_fulfillment_info: body.fulfillmentInfo ?? null,
  });
  if (error) {
    if (error.message === "CANDIDATE_REWARD_REDEMPTION_NOT_FOUND") return NextResponse.json({ error: "Không tìm thấy yêu cầu đổi quà." }, { status: 404 });
    if (error.message === "CANDIDATE_REWARD_FULFILLMENT_INVALID") return NextResponse.json({ error: "Cần nhập mã thẻ (thẻ quà) hoặc mã chuyển khoản (tiền mặt) để ghi nhận đã trao." }, { status: 400 });
    if (["CANDIDATE_REWARD_STATUS_CONFLICT", "CANDIDATE_REWARD_STATUS_INVALID"].includes(error.message)) return NextResponse.json({ error: "Trạng thái đã thay đổi hoặc không hợp lệ. Tải lại danh sách trước khi xử lý." }, { status: 409 });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-reward-redemptions", operation: "process_redemption", error });
    return NextResponse.json({ error: "Chưa xác định được trạng thái đổi quà đã lưu hay chưa. Tải lại trước khi thao tác tiếp.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, redemption: data });
}
