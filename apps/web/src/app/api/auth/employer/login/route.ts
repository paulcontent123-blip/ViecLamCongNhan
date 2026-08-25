import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/auth";
import {
  EMPLOYER_SESSION_COOKIE,
  EMPLOYER_SESSION_MAX_AGE,
  createEmployerSessionToken,
} from "@/lib/employer-session";

// NTD đăng nhập bằng Email HOẶC SĐT (khớp nhãn "Email \ SĐT" trong modal đăng nhập).
const bodySchema = z.object({
  identifier: z.string().min(3, "Vui lòng nhập email hoặc số điện thoại"),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email/SĐT hoặc mật khẩu không hợp lệ." }, { status: 400 });
  }
  const { password } = parsed.data;
  const identifier = parsed.data.identifier.trim();
  const emailIdentifier = identifier.toLowerCase();

  const supabase = createSupabaseAdminClient();
  // 2 truy vấn .eq() riêng biệt thay vì ghép chuỗi vào .or() — tránh identifier
  // chứa ký tự đặc biệt (,.()) làm sai lệch cú pháp filter của PostgREST.
  const baseQuery = () =>
    supabase
      .from("users")
      .select("id, email, password_hash, role, status, employers(id, company_name)")
      .eq("role", "employer")
      .eq("status", "active");

  const byEmail = await baseQuery().eq("email", emailIdentifier).maybeSingle();
  const { data: user, error } = byEmail.data
    ? byEmail
    : await baseQuery().eq("phone", identifier).maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Lỗi hệ thống, thử lại sau." }, { status: 500 });
  }

  const employer = Array.isArray(user?.employers) ? user.employers[0] : user?.employers;

  if (!user || !user.password_hash || !employer || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: "Thông tin đăng nhập không đúng." }, { status: 401 });
  }

  const token = await createEmployerSessionToken({
    userId: user.id,
    employerId: employer.id,
    email: user.email ?? identifier,
    companyName: employer.company_name,
  });

  const response = NextResponse.json({
    ok: true,
    employer: { id: employer.id, companyName: employer.company_name },
  });

  response.cookies.set(EMPLOYER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: EMPLOYER_SESSION_MAX_AGE,
  });

  return response;
}
