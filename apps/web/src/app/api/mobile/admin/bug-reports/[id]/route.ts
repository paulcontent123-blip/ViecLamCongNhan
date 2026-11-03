import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { BUG_REPORT_FIELDS, bugReportPatchSchema, flattenBugReport, validBugReportId, type BugReportRow } from "@/lib/bug-reports";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const headers = { "Cache-Control": "private, no-store" };

// Admin đổi trạng thái và/hoặc ghi chú của một báo lỗi. Biên tập và Superadmin đều làm được.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!validBugReportId(id)) return NextResponse.json({ error: "Báo lỗi không hợp lệ." }, { status: 400, headers });
  const parsed = bugReportPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin cập nhật chưa hợp lệ." }, { status: 400, headers });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  if (parsed.data.status !== undefined) Object.assign(update, { status: parsed.data.status, handled_by: auth.session.userId, handled_at: now });
  if (parsed.data.adminNote !== undefined) update.admin_note = parsed.data.adminNote?.trim() || null;

  const { data, error } = await createSupabaseAdminClient().from("bug_reports").update(update).eq("id", id).select(BUG_REPORT_FIELDS).maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/bug-reports/[id]", operation: "update_report", error });
    return NextResponse.json({ error: "Chưa lưu được thay đổi.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Không tìm thấy báo lỗi." }, { status: 404, headers });

  // Chỉ ghi nhật ký việc đổi trạng thái; không ghi nội dung báo lỗi.
  if (parsed.data.status !== undefined) await logAdminAction(auth.session, "bug_report.status", { type: "bug_report", id }, { status: parsed.data.status });
  return NextResponse.json({ ok: true, item: flattenBugReport(data as unknown as BugReportRow) }, { headers });
}
