import { NextRequest, NextResponse } from "next/server";
import { getEmployerSession } from "@/lib/employer-auth";
import { getEmployerAccountTier, isEmployerVerified } from "@/lib/employer";
import { ACCOUNT_TIERS, PAID_ACCOUNT_TIERS } from "@/lib/account-tiers";
import { JOB_ADDONS } from "@/lib/packages";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    const session = await getEmployerSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

    const { page, pageSize, offset } = parseEmployerListParams(request.nextUrl.searchParams, []);
    const supabase = createSupabaseAdminClient();
    const tier = await getEmployerAccountTier(session.employerId);
    const [verified, employerResult, result] = await Promise.all([
      isEmployerVerified(session.employerId),
      supabase.from("employers").select("account_tier_expires_at").eq("id", session.employerId).maybeSingle(),
      supabase.from("orders")
        .select("id, order_type, tier, amount, payment_method, status, created_at, paid_at", { count: "exact" })
        .eq("employer_id", session.employerId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1),
    ]);
    if (employerResult.error) throw employerResult.error;
    if (result.error) throw result.error;

    const items = result.data ?? [];
    const total = result.count ?? 0;
    const plans = PAID_ACCOUNT_TIERS.map((key) => ({
      key,
      label: ACCOUNT_TIERS[key].label,
      priceVnd: ACCOUNT_TIERS[key].priceVnd,
      billingCycleDays: ACCOUNT_TIERS[key].billingCycleDays,
      dailyPostLimit: ACCOUNT_TIERS[key].dailyPostLimit,
      jobDurationDays: ACCOUNT_TIERS[key].jobDurationDays,
      candidateViewLimit: ACCOUNT_TIERS[key].candidateViewLimit,
      showInSearch: ACCOUNT_TIERS[key].showInSearch,
      showOnHomepage: ACCOUNT_TIERS[key].showOnHomepage,
      matchingSupport: ACCOUNT_TIERS[key].matchingSupport,
    }));

    return NextResponse.json({
      ok: true,
      items,
      page,
      pageSize,
      total,
      hasMore: offset + items.length < total,
      account: {
        tier,
        label: ACCOUNT_TIERS[tier].label,
        expiresAt: employerResult.data?.account_tier_expires_at ?? null,
        verified,
      },
      plans,
      jobAddons: [{ key: "campaign", ...JOB_ADDONS.campaign }],
    }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("GET /api/mobile/employer/orders failed:", error);
    return NextResponse.json({ error: "Không tải được gói và đơn hàng." }, { status: 500, headers });
  }
}
