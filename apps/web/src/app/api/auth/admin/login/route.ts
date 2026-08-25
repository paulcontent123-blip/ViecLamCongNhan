import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE, createAdminSessionToken } from "@/lib/admin-session";
import { verifyPassword } from "@/lib/auth";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email hoặc mật khẩu không hợp lệ." }, { status: 400 });
  }
  const { password } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  const supabase = createSupabaseAdminClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, full_name, password_hash, role")
    .eq("role", "admin")
    .eq("status", "active")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Lỗi hệ thống, thử lại sau." }, { status: 500 });
  }

  if (!user || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: "Email hoặc mật khẩu không đúng." }, { status: 401 });
  }

  const token = await createAdminSessionToken({
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
  });

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, fullName: user.full_name },
  });

  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });

  return response;
}
