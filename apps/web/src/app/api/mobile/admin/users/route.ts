import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { adminAccountListQuery, parseAdminAccountFilters, publicAdminAccount } from "@/lib/mobile-admin-users";
import { z } from "zod";
import { createAdminUser } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const auth = await requireAdmin("admin_users");
  if (auth.error) { auth.error.headers.set("Cache-Control", headers["Cache-Control"]); return auth.error; }
  try {
    const params = request.nextUrl.searchParams;
    const { page, pageSize, offset } = parseEmployerListParams(params, ["active", "deleted"]);
    const filters = parseAdminAccountFilters(params);
    const { data, count, error } = await adminAccountListQuery(createSupabaseAdminClient(), filters, offset, pageSize);
    if (error) throw error;
    if (count === null) throw new Error("Missing account count");
    return NextResponse.json({ ok: true, items: (data || []).map(publicAdminAccount), total: count, page, pageSize }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/users", operation: "list_accounts", error });
    return NextResponse.json({ error: "Chưa tải được danh sách tài khoản.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
}

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72), adminRole: z.enum(["editor", "superadmin"]),
}).strict();

export async function POST(request: NextRequest) {
  const auth = await requireAdmin("admin_users");
  if (auth.error) return auth.error;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Buffer.byteLength(parsed.success ? parsed.data.password : "", "utf8") > 72)
    return NextResponse.json({ error: "Họ tên, email hoặc mật khẩu chưa hợp lệ." }, { status: 400, headers });
  const result = await createAdminUser({ ...parsed.data, role: "admin" }, auth.session.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers });
  await logAdminAction(auth.session, "user.create", { type: "user", id: result.user.id }, { role: "admin", adminRole: result.user.admin_role });
  return NextResponse.json({ ok: true, user: publicAdminAccount(result.user as unknown as Record<string, unknown>) }, { status: 201, headers });
}
