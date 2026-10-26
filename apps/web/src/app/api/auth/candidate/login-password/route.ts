import { NextRequest, NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { allowCandidatePasswordAuthAttempt, candidatePhoneVariants, normalizeCandidatePhone } from "@/lib/candidate-auth";
import { CANDIDATE_SESSION_COOKIE, CANDIDATE_SESSION_MAX_AGE, createCandidateSessionToken } from "@/lib/candidate-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({ phone: z.string().min(8).max(24), password: z.string().min(1).max(72) });
const INVALID_CREDENTIALS = "Số điện thoại hoặc mật khẩu không đúng.";
let dummyPasswordHash: Promise<string> | undefined;

function requestIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map(value => value.trim()).filter(Boolean);
  return request.headers.get("x-real-ip") || request.headers.get("x-vercel-forwarded-for") || forwarded?.[0] || "unknown";
}

async function verifyAgainstDummyHash(password: string): Promise<void> {
  dummyPasswordHash ??= hashPassword("candidate-password-login-dummy-value");
  await verifyPassword(password, await dummyPasswordHash);
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const phone = parsed.success ? normalizeCandidatePhone(parsed.data.phone) : null;
  if (!parsed.success || !phone || Buffer.byteLength(parsed.data.password, "utf8") > 72) {
    return NextResponse.json({ error: "Số điện thoại hoặc mật khẩu chưa hợp lệ." }, { status: 400 });
  }
  if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) {
    return NextResponse.json({ error: "Đăng nhập tài khoản hiện chưa khả dụng." }, { status: 503 });
  }

  let allowed: boolean;
  try { allowed = await allowCandidatePasswordAuthAttempt(phone, requestIp(request)); }
  catch { return NextResponse.json({ error: "Chưa thể kiểm tra giới hạn đăng nhập. Vui lòng thử lại sau." }, { status: 503 }); }
  if (!allowed) return NextResponse.json({ error: "Bạn đã thử quá nhiều lần. Vui lòng chờ trước khi tiếp tục." }, { status: 429 });

  const { data: users, error } = await createSupabaseAdminClient().from("users")
    .select("id,full_name,phone,password_hash,role,status,is_verified")
    .in("phone", candidatePhoneVariants(phone)).limit(2);
  if (error) return NextResponse.json({ error: "Không đăng nhập được lúc này. Vui lòng thử lại sau." }, { status: 503 });

  const user = users?.length === 1 ? users[0] : null;
  const eligible = user?.role === "candidate" && user.status === "active" && typeof user.password_hash === "string";
  let passwordMatches = false;
  try {
    if (eligible) passwordMatches = await verifyPassword(parsed.data.password, user.password_hash);
    else await verifyAgainstDummyHash(parsed.data.password);
  } catch {
    passwordMatches = false;
  }
  if (!eligible || !passwordMatches) return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });

  const token = await createCandidateSessionToken({ userId: user.id, phone, authMethod: "password" });
  const response = NextResponse.json({
    ok: true,
    candidate: { phone, fullName: user.full_name || "Công nhân", phoneVerified: user.is_verified === true },
  });
  response.cookies.set(CANDIDATE_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CANDIDATE_SESSION_MAX_AGE,
  });
  return response;
}
