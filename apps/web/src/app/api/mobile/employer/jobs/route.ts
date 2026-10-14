import { NextRequest, NextResponse } from "next/server";
import { getEmployerSession } from "@/lib/employer-auth";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };
const statuses = ["pending", "approved", "closed", "expired"] as const;

export async function GET(request: NextRequest) {
  try {
    const session = await getEmployerSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

    const { page, pageSize, offset, status } = parseEmployerListParams(request.nextUrl.searchParams, statuses);
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("jobs")
      .select("id, slug, title, status, tier, industry, province_code, apply_count, view_count, created_at, expires_at", { count: "exact" })
      .eq("employer_id", session.employerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error, count } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    const items = data ?? [];
    const total = count ?? 0;
    return NextResponse.json({ ok: true, items, page, pageSize, total, hasMore: offset + items.length < total }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("GET /api/mobile/employer/jobs failed:", error);
    return NextResponse.json({ error: "Không tải được tin tuyển dụng." }, { status: 500, headers });
  }
}
