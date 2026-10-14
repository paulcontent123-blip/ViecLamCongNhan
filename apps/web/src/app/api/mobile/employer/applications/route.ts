import { NextRequest, NextResponse } from "next/server";
import { getEmployerSession } from "@/lib/employer-auth";
import { APPLICATION_STATUSES } from "@/lib/application-status";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { EmployerApplicationRow } from "@/lib/employer";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    const session = await getEmployerSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

    const { page, pageSize, offset, status } = parseEmployerListParams(request.nextUrl.searchParams, APPLICATION_STATUSES);
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("applications")
      .select("id, status, created_at, updated_at, jobs(title, slug), candidates(id, full_name, province, desired_industry, experience_years)", { count: "exact" })
      .eq("employer_id", session.employerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error, count } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as EmployerApplicationRow[];
    const items = rows.map((row) => ({
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      jobs: row.jobs ? { title: row.jobs.title, slug: row.jobs.slug } : null,
      candidates: row.candidates ? {
        id: row.candidates.id,
        full_name: row.candidates.full_name,
        province: row.candidates.province,
        desired_industry: row.candidates.desired_industry,
        experience_years: row.candidates.experience_years,
      } : null,
    }));
    const total = count ?? 0;
    return NextResponse.json({ ok: true, items, page, pageSize, total, hasMore: offset + items.length < total }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("GET /api/mobile/employer/applications failed:", error);
    return NextResponse.json({ error: "Không tải được đơn ứng tuyển." }, { status: 500, headers });
  }
}
