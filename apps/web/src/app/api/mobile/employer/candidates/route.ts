import { NextRequest, NextResponse } from "next/server";
import { getEmployerSession } from "@/lib/employer-auth";
import { getEmployerAccountTier, getEmployerCandidateViewUsage, isEmployerVerified, listCandidatesForEmployer } from "@/lib/employer";
import { ACCOUNT_TIERS } from "@/lib/account-tiers";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    const session = await getEmployerSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

    const { page, pageSize, offset } = parseEmployerListParams(request.nextUrl.searchParams, []);
    const province = request.nextUrl.searchParams.get("province")?.trim() || undefined;
    const industry = request.nextUrl.searchParams.get("industry")?.trim() || undefined;
    if (province && province.length > 80) throw new RangeError("Tỉnh/thành không hợp lệ.");
    if (industry && industry.length > 100) throw new RangeError("Ngành nghề không hợp lệ.");

    const [tier, viewedCount, verified, result] = await Promise.all([
      getEmployerAccountTier(session.employerId),
      getEmployerCandidateViewUsage(session.employerId),
      isEmployerVerified(session.employerId),
      listCandidatesForEmployer({ province, industry, limit: pageSize, offset }),
    ]);

    let matchingSupport = false;
    if (ACCOUNT_TIERS[tier].matchingSupport) {
      const supabase = createSupabaseAdminClient();
      const { count, error } = await supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("employer_id", session.employerId)
        .eq("status", "approved")
        .not("industry", "is", null);
      if (error) throw error;
      matchingSupport = (count ?? 0) > 0;
    }

    const total = result.total;
    const items = result.candidates;
    return NextResponse.json({
      ok: true,
      items,
      page,
      pageSize,
      total,
      hasMore: offset + items.length < total,
      usage: {
        tier,
        verified,
        viewLimit: ACCOUNT_TIERS[tier].candidateViewLimit,
        viewedCount,
        matchingSupport,
      },
    }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("GET /api/mobile/employer/candidates failed:", error);
    return NextResponse.json({ error: "Không tải được kho ứng viên." }, { status: 500, headers });
  }
}
