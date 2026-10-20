import { NextRequest, NextResponse } from "next/server";
import { getEmployerSession } from "@/lib/employer-auth";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    const session = await getEmployerSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

    const { page, pageSize, offset } = parseEmployerListParams(request.nextUrl.searchParams, []);
    const { data, error, count } = await createSupabaseAdminClient().from("sms_blasts")
      .select("id, job_id, campaign_name, target_provinces, target_industries, channel, recipient_count, sent_count, cost_vnd, status, scheduled_at, sent_at, created_at", { count: "exact" })
      .eq("employer_id", session.employerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;

    const items = data ?? [];
    const total = count ?? 0;
    return NextResponse.json({ ok: true, items, page, pageSize, total, hasMore: offset + items.length < total }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("GET /api/mobile/employer/blasts failed:", error);
    return NextResponse.json({ error: "Không tải được lịch sử Blast." }, { status: 500, headers });
  }
}
