import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { adminAccountListQuery, parseAdminAccountFilters, publicAdminAccount } from "@/lib/mobile-admin-users";

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
