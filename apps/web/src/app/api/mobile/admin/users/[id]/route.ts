import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { MOBILE_ACCOUNT_FIELDS, accountExpectedSchema, publicAdminAccount, validAdminAccountId } from "@/lib/mobile-admin-users";
import { z } from "zod";
import { mutateAdminAccount } from "@/lib/admin-account-mutations";
import { softDeleteAdminUser } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE, createAdminSessionToken } from "@/lib/admin-session";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin("admin_users");
  if (auth.error) { auth.error.headers.set("Cache-Control", headers["Cache-Control"]); return auth.error; }
  const { id } = await params;
  if (!validAdminAccountId(id)) return NextResponse.json({ error: "Mã tài khoản không hợp lệ." }, { status: 400, headers });
  try {
    const { data, error } = await createSupabaseAdminClient().from("users").select(MOBILE_ACCOUNT_FIELDS).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404, headers });
    return NextResponse.json({ ok: true, user: publicAdminAccount(data) }, { headers });
  } catch (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/users/[id]", operation: "read_account", error });
    return NextResponse.json({ error: "Chưa tải được thông tin tài khoản.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
}

const updateSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).nullable(),
  adminRole: z.enum(["editor", "superadmin"]).nullable(),
  expected: accountExpectedSchema,
}).strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin("admin_users");
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!validAdminAccountId(id)) return NextResponse.json({ error: "Mã tài khoản không hợp lệ." }, { status: 400, headers });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin tài khoản chưa hợp lệ." }, { status: 400, headers });
  const { expected, fullName, email, adminRole } = parsed.data;
  if ((expected.role === "admin" && (!email || !adminRole)) || (expected.role !== "admin" && (email !== expected.email || adminRole !== null))) {
    return NextResponse.json({ error: "Không thể đổi thông tin liên hệ hoặc vai trò của tài khoản này tại đây." }, { status: 400, headers });
  }
  const result = await mutateAdminAccount(auth.session.userId, "update", id, {
    full_name: fullName, email: expected.role === "admin" ? email?.toLowerCase() ?? null : expected.email, phone: expected.phone, role: expected.role, admin_role: adminRole,
  }, expected);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers });
  await logAdminAction(auth.session, "user.update", { type: "user", id }, { role: result.user.role, adminRole: result.user.admin_role, previousAdminRole: expected.admin_role });
  const response = NextResponse.json({ ok: true, user: publicAdminAccount(result.user) }, { headers });
  if (id === auth.session.userId) {
    const token = await createAdminSessionToken({ userId: id, email: String(result.user.email || ""), fullName: String(result.user.full_name || "") });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: ADMIN_SESSION_MAX_AGE });
  }
  return response;
}

const deleteSchema = z.object({ expected: accountExpectedSchema }).strict();

// Xóa tài khoản: công nhân được dọn dữ liệu đầy đủ; vai trò khác đánh dấu đã xóa. Không xóa chính mình, không xóa Superadmin cuối cùng.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin("admin_users");
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!validAdminAccountId(id)) return NextResponse.json({ error: "Mã tài khoản không hợp lệ." }, { status: 400, headers });
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin tài khoản chưa hợp lệ." }, { status: 400, headers });
  const { expected } = parsed.data;
  const result = await softDeleteAdminUser(id, auth.session.userId, expected);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers });
  await logAdminAction(auth.session, "user.delete", { type: "user", id }, { role: expected.role, cleanup: expected.role === "candidate" ? "candidate_full" : "soft" });
  return NextResponse.json({ ok: true }, { headers });
}
