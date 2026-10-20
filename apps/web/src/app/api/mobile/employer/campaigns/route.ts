import { NextRequest, NextResponse } from "next/server";
import { getEmployerSession } from "@/lib/employer-auth";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };
const select = "id, slug, title, status, quantity, apply_count, view_count, expires_at, created_at, campaign_theme, campaign_story, description, requirements, salary_min, salary_max, job_type, province_code, district, industry, is_urgent, has_housing, has_shuttle, has_meals, no_experience_required, shift_type";

export async function GET(request: NextRequest) {
  try {
    const session = await getEmployerSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

    const { page, pageSize, offset } = parseEmployerListParams(request.nextUrl.searchParams, []);
    const supabase = createSupabaseAdminClient();
    const { data, error, count } = await supabase.from("jobs")
      .select(select, { count: "exact" })
      .eq("employer_id", session.employerId)
      .eq("tier", "campaign")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;

    const items = data ?? [];
    const jobIds = items.map((item) => item.id);
    const blastCounts = new Map<string, number>();
    if (jobIds.length) {
      const { data: blasts, error: blastError } = await supabase.from("sms_blasts")
        .select("job_id, recipient_count")
        .eq("employer_id", session.employerId)
        .in("job_id", jobIds);
      if (blastError) throw blastError;
      for (const blast of blasts ?? []) {
        if (blast.job_id) blastCounts.set(blast.job_id, (blastCounts.get(blast.job_id) ?? 0) + (blast.recipient_count ?? 0));
      }
    }

    const withCounts = items.map((item) => ({ ...item, blast_sent_count: blastCounts.get(item.id) ?? 0 }));
    const total = count ?? 0;
    return NextResponse.json({ ok: true, items: withCounts, page, pageSize, total, hasMore: offset + items.length < total }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("GET /api/mobile/employer/campaigns failed:", error);
    return NextResponse.json({ error: "Không tải được chiến dịch tuyển dụng." }, { status: 500, headers });
  }
}
