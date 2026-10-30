import { NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

// Trang kế tiếp (cũ hơn) của lịch sử điểm hoặc yêu cầu đổi quà, phân trang theo con trỏ (created_at, id).
const querySchema = z.object({
  kind: z.enum(["history", "requests"]),
  beforeAt: z.string().datetime({ offset: true }),
  beforeId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});

export async function GET(request: Request) {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập để xem điểm thưởng." }, { status: 401 });
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Tham số không hợp lệ." }, { status: 400 });
  const { kind, beforeAt, beforeId, limit } = parsed.data;
  const supabase = createSupabaseAdminClient();
  // Giữ nguyên chuỗi thời gian cơ sở dữ liệu trả (có micro giây) để con trỏ khớp chính xác; zod đã chặn ký tự lạ.
  const cursorFilter = `created_at.lt.${beforeAt},and(created_at.eq.${beforeAt},id.lt.${beforeId})`;

  const query = kind === "history"
    ? supabase.from("candidate_reward_ledger")
      .select("id,event_type,points_delta,source_reference,description,created_at")
    : supabase.from("candidate_reward_redemptions")
      .select("id,reward_title_snapshot,points_cost,status,reward_type_snapshot,reward_value_vnd_snapshot,reward_brand_snapshot,fulfillment_info,idempotency_key,admin_note,processed_at,created_at,updated_at");
  const { data, error } = await query
    .eq("user_id", session.userId)
    .or(cursorFilter)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/candidate/rewards/more", operation: `load_more_${kind}`, error });
    return NextResponse.json({ error: "Chưa tải được thêm dữ liệu.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, kind, items: data || [], limit });
}
