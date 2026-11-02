import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { ADMIN_ROLES } from "@/lib/admin-roles";
import { isAdminUserRole, softDeleteAdminUser, updateAdminUser } from "@/lib/admin";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE, createAdminSessionToken } from "@/lib/admin-session";

const bodySchema = z.object({
  fullName: z.string().trim().min(2, "Họ tên phải có ít nhất 2 ký tự."),
  email: z.string().trim().email("Email không hợp lệ.").optional().or(z.literal("")),
  phone: z.string().trim().min(9, "Số điện thoại không hợp lệ.").optional().or(z.literal("")),
  role: z.string().refine(isAdminUserRole, "Vai trò không hợp lệ."),
  adminRole: z.enum(ADMIN_ROLES).optional(),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự.").optional().or(z.literal("")),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin("admin_users");
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { id } = await params;
  if (id === session.userId && parsed.data.role !== "admin") {
    return NextResponse.json({ error: "Bạn không thể tự hạ quyền tài khoản Admin đang đăng nhập." }, { status: 409 });
  }

  if (id === session.userId && parsed.data.adminRole && parsed.data.adminRole !== session.adminRole) {
    return NextResponse.json({ error: "Bạn không thể tự đổi cấp quyền của tài khoản đang đăng nhập." }, { status: 409 });
  }

  const result = await updateAdminUser(id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  await logAdminAction(session, "user.update", { type: "user", id }, { role: result.user.role, adminRole: result.user.admin_role, passwordChanged: Boolean(parsed.data.password) });

  const response = NextResponse.json({ ok: true, user: result.user });
  if (id === session.userId) {
    const token = await createAdminSessionToken({
      userId: result.user.id,
      email: result.user.email ?? "",
      fullName: result.user.full_name,
    });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE,
    });
  }
  return response;
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin("admin_users");
  if (auth.error) return auth.error;
  const session = auth.session;

  const { id } = await params;
  if (id === session.userId) {
    return NextResponse.json({ error: "Bạn không thể xóa tài khoản Admin đang đăng nhập." }, { status: 409 });
  }

  const result = await softDeleteAdminUser(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  await logAdminAction(session, "user.delete", { type: "user", id });
  return NextResponse.json({ ok: true });
}
