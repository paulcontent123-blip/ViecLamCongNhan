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
    .select("id,user_id,reward_id,reward_title_snapshot,points_cost,status,admin_note,processed_at,created_at,updated_at,users!candidate_reward_redemptions_user_id_fkey(full_name,phone)", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (status !== "all") query = query.eq("status", status);
  if (id) query = query.eq("id", id);
  const { data, error, count } = await query;
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-reward-redemptions", operation: "list_redemptions", error });
    return NextResponse.json({ error: "Không tải được yêu cầu đổi quà.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, items: data || [], total: count || 0, page, pageSize, hasMore: page * pageSize < (count || 0) });
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const bodySchema = z.object({
    id: z.string().uuid(),
    expectedStatus: z.enum(["pending", "approved"]),
    status: z.enum(["approved", "rejected", "fulfilled"]),
    adminNote: z.string().trim().max(1000).optional(),
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
  });
  if (error) {
    if (error.message === "CANDIDATE_REWARD_REDEMPTION_NOT_FOUND") return NextResponse.json({ error: "Không tìm thấy yêu cầu đổi quà." }, { status: 404 });
    if (["CANDIDATE_REWARD_STATUS_CONFLICT", "CANDIDATE_REWARD_STATUS_INVALID"].includes(error.message)) return NextResponse.json({ error: "Trạng thái đã thay đổi hoặc không hợp lệ. Tải lại danh sách trước khi xử lý." }, { status: 409 });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-reward-redemptions", operation: "process_redemption", error });
    return NextResponse.json({ error: "Chưa xác định được trạng thái đổi quà đã lưu hay chưa. Tải lại trước khi thao tác tiếp.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, redemption: data });
}
