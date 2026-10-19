import { createHash, randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashCandidateOtp, normalizeCandidatePhone } from "@/lib/candidate-auth";
import { sendCandidateOtp } from "@/lib/candidate-otp-delivery";

const bodySchema = z.object({ phone: z.string().min(8).max(24) });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const phone = parsed.success ? normalizeCandidatePhone(parsed.data.phone) : null;
  if (!phone) return NextResponse.json({ error: "Số điện thoại chưa hợp lệ." }, { status: 400 });

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  let codeHash: string;
  try { codeHash = hashCandidateOtp(phone, code); }
  catch { return NextResponse.json({ error: "Đăng nhập bằng mã xác thực hiện chưa khả dụng." }, { status: 503 }); }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map(value => value.trim()).filter(Boolean);
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-vercel-forwarded-for") || forwarded?.at(-1) || "unknown";
  const ipHash = createHash("sha256").update(`${process.env.CANDIDATE_OTP_SECRET}:${ip}`).digest("hex");
  const supabase = createSupabaseAdminClient();
  const { data: challengeId, error } = await supabase.rpc("issue_candidate_otp", {
    p_phone: phone,
    p_code_hash: codeHash,
    p_ip_hash: ipHash,
    p_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  });
  if (error) return NextResponse.json({ error: "Chưa gửi được mã xác thực. Vui lòng thử lại sau." }, { status: 503 });
  if (!challengeId) return NextResponse.json({ error: "Bạn vừa yêu cầu mã gần đây. Vui lòng đợi rồi thử lại." }, { status: 429 });

  try {
    await sendCandidateOtp(phone, code);
  } catch {
    await supabase.from("candidate_otp_challenges").update({ revoked_at: new Date().toISOString() }).eq("id", challengeId);
    return NextResponse.json({ error: "Chưa gửi được mã qua Zalo. Vui lòng thử lại sau." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, expiresInSeconds: 300, retryAfterSeconds: 60 });
}
