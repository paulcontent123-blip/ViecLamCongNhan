import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFinanceProviderSession } from "@/lib/finance-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const headers = { "Cache-Control": "private, no-store" };
const schema = z.object({
  providerName: z.string().trim().min(2).max(160),
  providerType: z.enum(["bank", "finance_company", "remittance_provider", "other"]),
  contactName: z.string().trim().min(2).max(120), contactPhone: z.string().trim().min(9).max(20),
  provinceCode: z.string().trim().max(32).optional(), taxCode: z.string().trim().max(32).optional(),
  licenseNumber: z.string().trim().max(80).optional(), licenseEvidenceUrl: z.string().url().max(1000).optional().or(z.literal("")), description: z.string().trim().max(2000).optional(),
});

export async function GET() {
  const session = await getFinanceProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const { data, error } = await createSupabaseAdminClient().from("finance_providers")
    .select("id,provider_name,provider_slug,provider_type,contact_name,contact_phone,province_code,tax_code,license_number,license_evidence_url,description,logo_url,is_verified,contact_view_limit,account_type,account_tier_expires_at")
    .eq("id", session.providerId).maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/finance-provider/profile", operation: "load_profile", error });
    return NextResponse.json({ error: "Chưa tải được hồ sơ đối tác tài chính.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Không tìm thấy hồ sơ đối tác." }, { status: 404, headers });
  return NextResponse.json({ ok: true, provider: data, email: session.email }, { headers });
}

export async function PATCH(request: NextRequest) {
  const session = await getFinanceProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin hồ sơ không hợp lệ." }, { status: 400, headers });
  const input = parsed.data; const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("update_finance_provider_profile_atomically", {
    p_provider_id: session.providerId, p_user_id: session.userId, p_provider_name: input.providerName,
    p_provider_type: input.providerType, p_contact_name: input.contactName, p_contact_phone: input.contactPhone,
    p_province_code: input.provinceCode?.trim() || null, p_tax_code: input.taxCode?.trim() || null,
    p_license_number: input.licenseNumber?.trim() || null, p_license_evidence_url: input.licenseEvidenceUrl?.trim() || null, p_description: input.description?.trim() || null,
  });
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/finance-provider/profile", operation: "update_profile", error });
    return NextResponse.json({ error: "Chưa xác định được hồ sơ đã lưu hay chưa. Tải lại hồ sơ trước khi thao tác lại.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  if (data !== true) return NextResponse.json({ error: "Không thể cập nhật hồ sơ của phiên đăng nhập này." }, { status: 403, headers });
  const { data: latest, error: readError } = await supabase.from("finance_providers").select("is_verified").eq("id", session.providerId).maybeSingle();
  if (readError || !latest) {
    const requestId = readError ? logSafeSupabaseError({ route: "/api/mobile/finance-provider/profile", operation: "read_verification", error: readError }) : undefined;
    return NextResponse.json({ error: "Hồ sơ đã cập nhật nhưng chưa xác nhận được trạng thái xác minh.", ...(requestId ? { requestId } : {}) }, { status: 503, headers: requestId ? { ...headers, "X-Request-Id": requestId } : headers });
  }
  return NextResponse.json({ ok: true, isVerified: latest.is_verified }, { headers });
}
