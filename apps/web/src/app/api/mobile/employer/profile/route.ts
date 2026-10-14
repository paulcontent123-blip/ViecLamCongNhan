import { NextResponse } from "next/server";
import { getEmployerSession } from "@/lib/employer-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const session = await getEmployerSession();
  if (!session) {
    return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("employers")
    .select("id, company_name, company_slug, company_logo_url, industry, province_code, tax_code, contact_phone, is_verified, account_type, account_tier_expires_at, users(email, full_name)")
    .eq("id", session.employerId)
    .maybeSingle();

  if (error) {
    console.error("GET /api/mobile/employer/profile failed:", error);
    return NextResponse.json({ error: "Không tải được hồ sơ doanh nghiệp." }, { status: 500, headers });
  }
  if (!data) {
    return NextResponse.json({ error: "Không tìm thấy hồ sơ doanh nghiệp." }, { status: 404, headers });
  }

  const user = Array.isArray(data.users) ? data.users[0] : data.users;
  return NextResponse.json({
    ok: true,
    profile: {
      id: data.id,
      companyName: data.company_name,
      companySlug: data.company_slug,
      companyLogoUrl: data.company_logo_url,
      email: user?.email ?? null,
      fullName: user?.full_name ?? null,
      contactPhone: data.contact_phone,
      taxCode: data.tax_code,
      provinceCode: data.province_code,
      industry: data.industry,
      isVerified: data.is_verified,
      accountTier: data.account_type,
      accountTierExpiresAt: data.account_tier_expires_at,
    },
  }, { headers });
}
