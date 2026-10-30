import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

// Heartbeat khi app đang mở ở foreground. Body bị bỏ qua: server tự tính thời gian online
// từ mốc heartbeat của chính nó và áp giới hạn trong candidate_online_point_settings.
export async function POST() {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập để tích điểm." }, { status: 401 });
  const { data, error } = await createSupabaseAdminClient().rpc("record_candidate_presence", { p_user_id: session.userId });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/candidate/presence", operation: "record_candidate_presence", error: error || new Error("Empty presence result") });
    return NextResponse.json({ error: "Chưa ghi nhận được thời gian online.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({
    ok: true,
    enabled: row.is_enabled === true,
    awarded: Number(row.awarded) || 0,
    todayPoints: Number(row.today_points) || 0,
    dailyCap: Number(row.daily_cap) || 0,
    idleTimeoutSeconds: Number(row.idle_timeout_seconds) || 180,
  });
}
