import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

export async function GET() {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập để xem điểm thưởng." }, { status: 401 });
  const supabase = createSupabaseAdminClient();
  const [balanceResult, ledgerResult, rewardResult, redemptionResult] = await Promise.all([
    supabase.rpc("get_candidate_reward_balance", { p_user_id: session.userId }),
    supabase.from("candidate_reward_ledger")
      .select("id,event_type,points_delta,source_reference,description,created_at")
      .eq("user_id", session.userId).order("created_at", { ascending: false }).limit(50),
    supabase.from("candidate_reward_catalog")
      .select("id,title,description,image_url,points_cost,stock_remaining")
      .eq("is_active", true).order("points_cost", { ascending: true }).limit(100),
    supabase.from("candidate_reward_redemptions")
      .select("id,reward_title_snapshot,points_cost,status,idempotency_key,admin_note,processed_at,created_at,updated_at")
      .eq("user_id", session.userId).order("created_at", { ascending: false }).limit(50),
  ]);
  const failed = [balanceResult.error, ledgerResult.error, rewardResult.error, redemptionResult.error].find(Boolean);
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
  return NextResponse.json({
    ok: true,
    balance,
    history,
    rewards: rewardResult.data || [],
    redemptions: redemptionResult.data || [],
  });
}
