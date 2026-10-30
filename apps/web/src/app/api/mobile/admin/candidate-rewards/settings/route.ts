import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

// Cài đặt chung của quà đổi điểm. null = tắt. Hiện gồm ngưỡng cảnh báo và giới hạn quà tiền mặt mỗi người mỗi tháng.
const SELECT = "cash_monthly_alert_vnd,cash_monthly_cap_vnd,updated_at";

const patchSchema = z.object({
  cashMonthlyAlertVnd: z.number().int().min(1).max(1000000000).nullable().optional(),
  cashMonthlyCapVnd: z.number().int().min(1).max(1000000000).nullable().optional(),
}).refine(value => Object.keys(value).length > 0, { message: "Không có trường cần cập nhật." });

function toResponse(row: { cash_monthly_alert_vnd: number | null; cash_monthly_cap_vnd: number | null; updated_at: string }) {
  return { cashMonthlyAlertVnd: row.cash_monthly_alert_vnd, cashMonthlyCapVnd: row.cash_monthly_cap_vnd, updatedAt: row.updated_at };
}

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { data, error } = await createSupabaseAdminClient().from("candidate_reward_settings").select(SELECT).eq("id", true).maybeSingle();
  if (error || !data) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-rewards/settings", operation: "read_settings", error: error || new Error("Missing settings row") });
    return NextResponse.json({ error: "Không tải được cài đặt quà.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, settings: toResponse(data) });
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Cài đặt chưa hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: current, error: readError } = await supabase.from("candidate_reward_settings").select(SELECT).eq("id", true).maybeSingle();
  if (readError || !current) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-rewards/settings", operation: "read_settings_before_update", error: readError || new Error("Missing settings row") });
    return NextResponse.json({ error: "Không tải được cài đặt quà.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const alert = parsed.data.cashMonthlyAlertVnd !== undefined ? parsed.data.cashMonthlyAlertVnd : current.cash_monthly_alert_vnd;
  const cap = parsed.data.cashMonthlyCapVnd !== undefined ? parsed.data.cashMonthlyCapVnd : current.cash_monthly_cap_vnd;
  if (alert !== null && cap !== null && alert > cap) {
    return NextResponse.json({ error: "Mức cảnh báo phải nhỏ hơn hoặc bằng mức giới hạn." }, { status: 400 });
  }
  const { data, error } = await supabase.from("candidate_reward_settings").update({
    cash_monthly_alert_vnd: alert,
    cash_monthly_cap_vnd: cap,
    updated_at: new Date().toISOString(),
    updated_by: admin.userId,
  }).eq("id", true).select(SELECT).maybeSingle();
  if (error || !data) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-rewards/settings", operation: "update_settings", error: error || new Error("Empty update result") });
    return NextResponse.json({ error: "Chưa lưu được cài đặt quà.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, settings: toResponse(data) });
}
