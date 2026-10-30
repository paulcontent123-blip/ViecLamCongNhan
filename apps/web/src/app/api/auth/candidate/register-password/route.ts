import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { allowCandidatePasswordAuthAttempt, normalizeCandidatePhone } from "@/lib/candidate-auth";
import { CANDIDATE_SESSION_COOKIE, CANDIDATE_SESSION_MAX_AGE, createCandidateSessionToken } from "@/lib/candidate-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  phone: z.string().min(8).max(24),
  fullName: z.string().trim().min(2).max(100),
  province: z.string().trim().max(100).optional(),
  password: z.string().min(8).max(72),
});

function requestIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map(value => value.trim()).filter(Boolean);
  return request.headers.get("x-real-ip") || request.headers.get("x-vercel-forwarded-for") || forwarded?.[0] || "unknown";
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const phone = parsed.success ? normalizeCandidatePhone(parsed.data.phone) : null;
  if (!parsed.success || !phone || Buffer.byteLength(parsed.data.password, "utf8") > 72) {
    return NextResponse.json({ error: "Thông tin đăng ký chưa hợp lệ. Số điện thoại cần có 10 chữ số; mật khẩu từ 8 ký tự." }, { status: 400 });
  }
  if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) {
    return NextResponse.json({ error: "Đăng ký tài khoản hiện chưa khả dụng." }, { status: 503 });
  }

  let allowed: boolean;
  try { allowed = await allowCandidatePasswordAuthAttempt(phone, requestIp(request)); }
  catch { return NextResponse.json({ error: "Chưa thể kiểm tra giới hạn đăng ký. Vui lòng thử lại sau." }, { status: 503 }); }
  if (!allowed) return NextResponse.json({ error: "Bạn đã thử quá nhiều lần. Vui lòng chờ trước khi tiếp tục." }, { status: 429 });

  let passwordHash: string;
  try { passwordHash = await hashPassword(parsed.data.password); }
  catch { return NextResponse.json({ error: "Chưa tạo được tài khoản. Vui lòng thử lại sau." }, { status: 503 }); }

  const { data, error } = await createSupabaseAdminClient().rpc("register_candidate_password_account", {
    p_phone: phone,
    p_full_name: parsed.data.fullName,
    p_password_hash: passwordHash,
  });
  if (error) return NextResponse.json({ error: "Chưa tạo được tài khoản. Vui lòng thử lại sau." }, { status: 503 });
  const result = Array.isArray(data) ? data[0] : data;
  if (result?.created !== true || typeof result.user_id !== "string") {
    return NextResponse.json({ error: "Không thể đăng ký bằng số này. Nếu bạn đã ứng tuyển hoặc có tài khoản, hãy đăng nhập bằng OTP để xác minh và nhận hồ sơ." }, { status: 409 });
  }

  // Tỉnh/thành là thông tin hồ sơ, không chặn đăng ký nếu ghi thất bại; người dùng sửa được ở màn Tài khoản.
  const province = parsed.data.province;
  if (province) await createSupabaseAdminClient().from("candidates").update({ province }).eq("user_id", result.user_id);

  const token = await createCandidateSessionToken({ userId: result.user_id, phone, authMethod: "password" });
  const response = NextResponse.json({
    ok: true,
    candidate: { phone, fullName: result.full_name || parsed.data.fullName, phoneVerified: false },
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
