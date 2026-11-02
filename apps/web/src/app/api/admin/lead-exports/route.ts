import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { LEAD_MAX_EXPORT, buildLeadCsv, leadExportQuery, parseLeadExtras, type LeadRow } from "@/lib/lead-export";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { parseWorkerInquiryFilters } from "@/lib/worker-inquiries";

// Xuất CSV các liên hệ công nhân đã đồng ý chia sẻ theo bộ lọc của trang Yêu cầu dịch vụ công nhân (chỉ Superadmin).
// Tệp chỉ nằm trong phản hồi, không lưu trên máy chủ. Mỗi lần xuất chỉ ghi vào nhật ký Admin (không ghi lô, không đánh dấu đã giao).
const headers = { "Cache-Control": "private, no-store" };

const bodySchema = z.object({
  partnerName: z.string().trim().min(2, "Nhập tên đối tác nhận (tối thiểu 2 ký tự).").max(120, "Tên đối tác tối đa 120 ký tự."),
  filters: z.object({
    kind: z.string().max(40).optional(), status: z.string().max(20).optional(), q: z.string().max(100).optional(),
    category: z.string().max(40).optional(), province: z.string().max(40).optional(),
  }).strict().optional(),
}).strict();

export async function POST(request: NextRequest) {
  const auth = await requireAdmin("lead_export");
  if (auth.error) return auth.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin xuất không hợp lệ." }, { status: 400, headers });

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed.data.filters ?? {})) if (value) params.set(key, value);
  let filters;
  let extras;
  try {
    filters = parseWorkerInquiryFilters(params);
    extras = parseLeadExtras(params, filters.kind);
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    throw error;
  }

  const { data, error } = await leadExportQuery(createSupabaseAdminClient(), filters, extras)
    .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(LEAD_MAX_EXPORT + 1);
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/admin/lead-exports", operation: "select_leads", error });
    return NextResponse.json({ error: "Chưa đọc được dữ liệu để xuất.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  const rows = (data ?? []) as unknown as LeadRow[];
  if (rows.length === 0) return NextResponse.json({ error: "Không có liên hệ nào phù hợp để xuất (cần công nhân đã đồng ý chia sẻ và yêu cầu còn ở Admin)." }, { status: 404, headers });
  if (rows.length > LEAD_MAX_EXPORT) return NextResponse.json({ error: `Có hơn ${LEAD_MAX_EXPORT} liên hệ phù hợp. Hãy thu hẹp bộ lọc (loại, trạng thái, tìm kiếm, nhóm nhu cầu, tỉnh) rồi xuất lại.` }, { status: 400, headers });

  await logAdminAction(auth.session, "lead_export.create", { type: "lead_export" }, {
    partner: parsed.data.partnerName, count: rows.length,
    filters: { kind: filters.kind, status: filters.status, q: filters.q, category: extras.category, province: extras.province },
  });

  return new Response(buildLeadCsv(rows), {
    status: 200,
    headers: {
      ...headers,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="du-lieu-lien-he-${new Date().toISOString().slice(0, 10)}.csv"`,
      "X-Row-Count": String(rows.length),
    },
  });
}
