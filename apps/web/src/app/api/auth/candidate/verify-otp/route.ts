import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashCandidateOtp, normalizeCandidatePhone } from "@/lib/candidate-auth";
import { CANDIDATE_SESSION_COOKIE, CANDIDATE_SESSION_MAX_AGE, createCandidateSessionToken } from "@/lib/candidate-session";

const bodySchema = z.object({ phone: z.string().min(8).max(24), code: z.string().regex(/^\d{6}$/) });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const phone = parsed.success ? normalizeCandidatePhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) return NextResponse.json({ error: "Số điện thoại hoặc mã xác thực chưa hợp lệ." }, { status: 400 });

  let codeHash: string;
  try { codeHash = hashCandidateOtp(phone, parsed.data.code); }
  catch { return NextResponse.json({ error: "Đăng nhập bằng mã xác thực hiện chưa khả dụng." }, { status: 503 }); }

  const { data, error } = await createSupabaseAdminClient().rpc("complete_candidate_otp", {
    p_phone: phone,
    p_code_hash: codeHash,
  });
  if (error) return NextResponse.json({ error: "Không xác minh được mã. Vui lòng thử lại." }, { status: 503 });
  const result = Array.isArray(data) ? data[0] : data;
  if (result?.account_conflict) return NextResponse.json({ error: "Số điện thoại này thuộc vai trò tài khoản khác." }, { status: 409 });
  if (result?.valid !== true || typeof result.user_id !== "string") {
    return NextResponse.json({ error: "Mã không đúng hoặc đã hết hạn. Vui lòng yêu cầu mã mới." }, { status: 401 });
  }

  const token = await createCandidateSessionToken({ userId: result.user_id, phone });
  const response = NextResponse.json({ ok: true, candidate: { phone, fullName: result.full_name || "Công nhân" } });
  response.cookies.set(CANDIDATE_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CANDIDATE_SESSION_MAX_AGE,
  });
  return response;
}
