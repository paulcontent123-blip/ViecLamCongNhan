import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const bodySchema = z.object({
  rewardId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(100),
});

export async function POST(request: NextRequest) {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập để đổi quà." }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin đổi quà không hợp lệ." }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().rpc("request_candidate_reward_redemption", {
    p_user_id: session.userId,
    p_reward_id: parsed.data.rewardId,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) {
    const knownErrors: Record<string, { message: string; status: number }> = {
      CANDIDATE_REWARD_UNAVAILABLE: { message: "Quà này hiện không còn đổi được.", status: 409 },
      CANDIDATE_REWARD_INSUFFICIENT_POINTS: { message: "Bạn chưa có đủ điểm để đổi quà này.", status: 409 },
      CANDIDATE_REWARD_USER_INVALID: { message: "Tài khoản công nhân không còn hoạt động.", status: 403 },
    };
    const known = knownErrors[error.message];
    if (known) return NextResponse.json({ error: known.message }, { status: known.status });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/candidate/reward-redemptions", operation: "create_redemption", error });
    return NextResponse.json({ error: "Chưa xác định được yêu cầu đổi quà đã lưu hay chưa. Tải lại lịch sử trước khi thử lại.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, redemption: data }, { status: 201 });
}
