import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { BUG_REPORT_FIELDS, BUG_REPORT_STATUSES, flattenBugReport, type BugReportRow } from "@/lib/bug-reports";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const headers = { "Cache-Control": "private, no-store" };

// Danh sách báo lỗi ứng dụng cho Admin (Biên tập và Superadmin), mới nhất trước; lọc theo trạng thái.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) { auth.error.headers.set("Cache-Control", headers["Cache-Control"]); return auth.error; }
  try {
    const { page, pageSize, offset, status } = parseEmployerListParams(request.nextUrl.searchParams, [...BUG_REPORT_STATUSES]);
    const supabase = createSupabaseAdminClient();
    let list = supabase.from("bug_reports").select(BUG_REPORT_FIELDS, { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false });
    if (status) list = list.eq("status", status);
    const [result, pending] = await Promise.all([
      list.range(offset, offset + pageSize - 1),
      supabase.from("bug_reports").select("id", { count: "exact", head: true }).eq("status", "new"),
    ]);
    if (result.error) throw result.error;
    if (pending.error) throw pending.error;
    if (result.count === null) throw new Error("Missing bug report count");
    const items = ((result.data ?? []) as unknown as BugReportRow[]).map(flattenBugReport);
    return NextResponse.json({ ok: true, items, total: result.count, newCount: pending.count ?? 0, page, pageSize }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/bug-reports", operation: "list_reports", error });
    return NextResponse.json({ error: "Chưa tải được báo lỗi.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
}
