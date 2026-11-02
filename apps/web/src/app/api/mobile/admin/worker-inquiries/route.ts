import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { ADMIN_INQUIRY_STATUSES, parseWorkerInquiryFilters, workerInquiryForwardingEnabled, workerInquiryListQuery } from "@/lib/worker-inquiries";

const headers = { "Cache-Control": "private, no-store" };

// Hàng đợi yêu cầu dịch vụ của công nhân (học nghề, hồ sơ học viên, bảo hiểm, tài chính). Mặc định chỉ yêu cầu còn ở Admin.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) { auth.error.headers.set("Cache-Control", headers["Cache-Control"]); return auth.error; }
  try {
    const params = request.nextUrl.searchParams;
    const { page, pageSize, offset } = parseEmployerListParams(params, [...ADMIN_INQUIRY_STATUSES]);
    const filters = parseWorkerInquiryFilters(params);
    const supabase = createSupabaseAdminClient();
    const [list, pending] = await Promise.all([
      workerInquiryListQuery(supabase, filters, offset, pageSize),
      supabase.from("admin_worker_inquiries").select("id", { count: "exact", head: true }).eq("routed_to", "admin").eq("admin_status", "new"),
    ]);
    if (list.error) throw list.error;
    if (pending.error) throw pending.error;
    if (list.count === null) throw new Error("Missing inquiry count");
    return NextResponse.json({ ok: true, items: list.data || [], total: list.count, newCount: pending.count ?? 0, forwardingEnabled: workerInquiryForwardingEnabled(), page, pageSize }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/worker-inquiries", operation: "list_inquiries", error });
    return NextResponse.json({ error: "Chưa tải được yêu cầu của công nhân.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
}
