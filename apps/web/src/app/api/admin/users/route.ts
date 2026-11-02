import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { ADMIN_ROLES } from "@/lib/admin-roles";
import { createAdminUser, isAdminUserRole } from "@/lib/admin";

const bodySchema = z.object({
  fullName: z.string().trim().min(2, "Họ tên phải có ít nhất 2 ký tự."),
  email: z.string().trim().email("Email không hợp lệ.").optional().or(z.literal("")),
  phone: z.string().trim().min(9, "Số điện thoại không hợp lệ.").optional().or(z.literal("")),
  role: z.string().refine(isAdminUserRole, "Vai trò không hợp lệ."),
  adminRole: z.enum(ADMIN_ROLES).optional(),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự.").optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin("admin_users");
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const result = await createAdminUser(parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  await logAdminAction(session, "user.create", { type: "user", id: result.user.id }, { role: result.user.role, adminRole: result.user.admin_role });
  return NextResponse.json({ ok: true, user: result.user }, { status: 201 });
}
