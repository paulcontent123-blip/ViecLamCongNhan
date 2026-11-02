import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { MOBILE_ACCOUNT_FIELDS, publicAdminAccount, validAdminAccountId } from "@/lib/mobile-admin-users";

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
