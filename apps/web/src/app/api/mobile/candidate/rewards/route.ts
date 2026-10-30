import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

export async function GET() {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập để xem điểm thưởng." }, { status: 401 });
  const supabase = createSupabaseAdminClient();
  const [balanceResult, ledgerResult, rewardResult, redemptionResult, onlineResult] = await Promise.all([
    supabase.rpc("get_candidate_reward_balance", { p_user_id: session.userId }),
    supabase.from("candidate_reward_ledger")
      .select("id,event_type,points_delta,source_reference,description,created_at")
      .eq("user_id", session.userId).order("created_at", { ascending: false }).limit(50),
    supabase.from("candidate_reward_catalog")
      .select("id,title,description,image_url,points_cost,stock_remaining,reward_type,value_vnd,brand,is_service")
      .eq("is_active", true).order("points_cost", { ascending: true }).limit(100),
    supabase.from("candidate_reward_redemptions")
      .select("id,reward_title_snapshot,points_cost,status,reward_type_snapshot,reward_value_vnd_snapshot,reward_brand_snapshot,fulfillment_info,idempotency_key,admin_note,processed_at,created_at,updated_at")
      .eq("user_id", session.userId).order("created_at", { ascending: false }).limit(50),
    supabase.rpc("get_candidate_online_status", { p_user_id: session.userId }),
  ]);
  const failed = [balanceResult.error, ledgerResult.error, rewardResult.error, redemptionResult.error, onlineResult.error].find(Boolean);
  if (failed) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/candidate/rewards", operation: "load_candidate_rewards", error: failed });
    return NextResponse.json({ error: "Chưa tải được điểm thưởng.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const history = ledgerResult.data || [];
  const balance = Number(balanceResult.data);
  if (!Number.isSafeInteger(balance)) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/candidate/rewards", operation: "validate_candidate_reward_balance", error: new Error("Invalid balance RPC result") });
    return NextResponse.json({ error: "Chưa tải được điểm thưởng.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const online = Array.isArray(onlineResult.data) ? onlineResult.data[0] : onlineResult.data;
  return NextResponse.json({
    ok: true,
    balance,
    lifetimePoints: Number(online?.lifetime_points) || 0,
    online: online ? {
      enabled: online.enabled === true,
      pointsPerInterval: Number(online.points_per_interval) || 0,
      intervalMinutes: Number(online.interval_minutes) || 0,
      dailyCap: Number(online.daily_points_cap) || 0,
      todayPoints: Number(online.today_points) || 0,
    } : null,
    history,
    rewards: rewardResult.data || [],
    redemptions: redemptionResult.data || [],
  });
}
