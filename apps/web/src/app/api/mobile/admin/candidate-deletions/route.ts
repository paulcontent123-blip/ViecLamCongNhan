import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

// Danh sách yêu cầu xóa tài khoản cho Admin: công nhân, nhà tuyển dụng và đối tác (trường `role` cho biết vai trò).
//  GET ?status=pending|approved|rejected|cancelled&page&pageSize

const headers = { "Cache-Control": "private, no-store" };
const STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
const FIELDS = "id,status,reason,requested_at,handled_at,admin_note,users!candidate_deletion_requests_user_id_fkey(id,full_name,phone,status,role)";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin("admin_users");
  if (auth.error) {
    auth.error.headers.set("Cache-Control", headers["Cache-Control"]);
    return auth.error;
  }
  try {
    const { page, pageSize, offset, status } = parseEmployerListParams(request.nextUrl.searchParams, [...STATUSES]);
    const supabase = createSupabaseAdminClient();
    let list = supabase.from("candidate_deletion_requests").select(FIELDS, { count: "exact" })
      .order("requested_at", { ascending: false }).order("id", { ascending: false });
    if (status) list = list.eq("status", status);

    const [result, pending] = await Promise.all([
      list.range(offset, offset + pageSize - 1),
      supabase.from("candidate_deletion_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    if (result.error) throw result.error;
    if (pending.error) throw pending.error;
    if (result.count === null) throw new Error("Missing deletion request count");

    const items = (result.data ?? []).map((row) => {
      const user = Array.isArray(row.users) ? row.users[0] : row.users;
      return {
        id: row.id,
        status: row.status,
        reason: row.reason,
        requested_at: row.requested_at,
        handled_at: row.handled_at,
        admin_note: row.admin_note,
        full_name: user?.full_name ?? null,
        phone: user?.phone ?? null,
        account_status: user?.status ?? null,
        role: user?.role ?? null,
      };
    });
    return NextResponse.json({ ok: true, items, total: result.count, pendingCount: pending.count ?? 0, page, pageSize }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-deletions", operation: "list_requests", error });
    return NextResponse.json(
      { error: "Chưa tải được yêu cầu xóa tài khoản.", requestId },
      { status: 503, headers: { ...headers, "X-Request-Id": requestId } },
    );
  }
}
