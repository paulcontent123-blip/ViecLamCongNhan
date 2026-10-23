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
  licenseNumber: z.string().trim().min(1, "Nhập số giấy phép / ủy quyền.").max(80),
  licenseEvidenceUrl: z.string().trim().min(1, "Tải hồ sơ giấy phép hoặc nhập liên kết.").max(1200).refine(value => value.startsWith("private-storage:") || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(value), "Liên kết hồ sơ giấy phép không hợp lệ."),
  description: z.string().trim().max(2000).optional(),
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
  if (input.licenseEvidenceUrl.startsWith("private-storage:")) {
    const objectPath = input.licenseEvidenceUrl.slice("private-storage:".length);
    if (!objectPath.startsWith(`${session.providerId}/`) || objectPath.includes("..")) return NextResponse.json({ error: "Hồ sơ giấy phép không thuộc đơn vị này." }, { status: 400, headers });
    const filename = objectPath.slice(session.providerId.length + 1);
    const { data: files, error: storageError } = await supabase.storage.from("finance-license-evidence").list(session.providerId, { search: filename, limit: 2 });
    if (storageError) {
      const requestId = logSafeSupabaseError({ route: "/api/mobile/finance-provider/profile", operation: "check_license_evidence", error: storageError });
      return NextResponse.json({ error: "Chưa xác minh được tệp hồ sơ giấy phép.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
    }
    if (!files?.some(file => file.name === filename)) return NextResponse.json({ error: "Không tìm thấy hồ sơ giấy phép đã tải lên." }, { status: 400, headers });
  }
  const { data, error } = await supabase.rpc("update_finance_provider_profile_atomically", {
    p_provider_id: session.providerId, p_user_id: session.userId, p_provider_name: input.providerName,
    p_provider_type: input.providerType, p_contact_name: input.contactName, p_contact_phone: input.contactPhone,
    p_province_code: input.provinceCode?.trim() || null, p_tax_code: input.taxCode?.trim() || null,
    p_license_number: input.licenseNumber.trim(), p_license_evidence_url: input.licenseEvidenceUrl.trim(), p_description: input.description?.trim() || null,
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
