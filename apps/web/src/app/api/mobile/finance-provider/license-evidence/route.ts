import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getFinanceProviderSession } from "@/lib/finance-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const BUCKET = "finance-license-evidence";
const MAX_SIZE = 10 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  const session = await getFinanceProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) return NextResponse.json({ error: "Vui lòng chọn ảnh hoặc PDF hồ sơ giấy phép." }, { status: 400, headers });
  const extension = TYPES[file.type];
  if (!extension) return NextResponse.json({ error: "Chỉ hỗ trợ PDF, JPG, PNG hoặc WEBP." }, { status: 400, headers });
  if (file.size <= 0 || file.size > MAX_SIZE) return NextResponse.json({ error: "Tệp phải lớn hơn 0 byte và tối đa 10MB." }, { status: 400, headers });

  const supabase = createSupabaseAdminClient();
  const { data: provider, error: readError } = await supabase.from("finance_providers")
    .select("provider_name,provider_type,contact_name,contact_phone,province_code,tax_code,license_number,license_evidence_url,description")
    .eq("id", session.providerId).maybeSingle();
  if (readError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/finance-provider/license-evidence", operation: "load_provider", error: readError });
    return NextResponse.json({ error: "Chưa tải được hồ sơ đối tác.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  if (!provider) return NextResponse.json({ error: "Không tìm thấy hồ sơ đối tác." }, { status: 404, headers });

  const path = `${session.providerId}/${randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, new Uint8Array(await file.arrayBuffer()), {
    cacheControl: "0", contentType: file.type, upsert: false,
  });
  if (uploadError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/finance-provider/license-evidence", operation: "upload_evidence", error: uploadError });
    return NextResponse.json({ error: "Chưa tải được hồ sơ giấy phép lên kho riêng tư.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }

  const evidenceRef = `private-storage:${path}`;
  const rpc = await supabase.rpc("update_finance_provider_profile_atomically", {
    p_provider_id: session.providerId, p_user_id: session.userId,
    p_provider_name: provider.provider_name, p_provider_type: provider.provider_type,
    p_contact_name: provider.contact_name, p_contact_phone: provider.contact_phone,
    p_province_code: provider.province_code, p_tax_code: provider.tax_code,
    p_license_number: provider.license_number, p_license_evidence_url: evidenceRef,
    p_description: provider.description,
  });

  if (rpc.error || rpc.data !== true) {
    const requestId = rpc.error ? logSafeSupabaseError({ route: "/api/mobile/finance-provider/license-evidence", operation: "save_evidence_reference", error: rpc.error }) : undefined;
    const { data: latest, error: readBackError } = await supabase.from("finance_providers").select("license_evidence_url,is_verified")
      .eq("id", session.providerId).maybeSingle();
    if (!readBackError && latest?.license_evidence_url === evidenceRef) {
      return NextResponse.json({ ok: true, licenseEvidenceUrl: evidenceRef, isVerified: latest.is_verified }, { headers });
    }
    if (!readBackError && latest && latest.license_evidence_url === provider.license_evidence_url) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
      return NextResponse.json({ error: "Chưa lưu được liên kết hồ sơ giấy phép.", ...(requestId ? { requestId } : {}) }, { status: 503, headers: requestId ? { ...headers, "X-Request-Id": requestId } : headers });
    }
    const uncertainId = requestId ?? (readBackError ? logSafeSupabaseError({ route: "/api/mobile/finance-provider/license-evidence", operation: "verify_evidence_reference", error: readBackError }) : undefined);
    return NextResponse.json({ error: "Chưa xác định được hồ sơ giấy phép đã lưu hay chưa. Tải lại hồ sơ trước khi thử lại.", ...(uncertainId ? { requestId: uncertainId } : {}) }, { status: 503, headers: uncertainId ? { ...headers, "X-Request-Id": uncertainId } : headers });
  }

  const { data: latest, error: verifyError } = await supabase.from("finance_providers").select("license_evidence_url,is_verified")
    .eq("id", session.providerId).maybeSingle();
  if (verifyError || latest?.license_evidence_url !== evidenceRef) {
    const requestId = verifyError ? logSafeSupabaseError({ route: "/api/mobile/finance-provider/license-evidence", operation: "read_back_evidence", error: verifyError }) : undefined;
    return NextResponse.json({ error: "Chưa xác nhận được hồ sơ giấy phép đã lưu. Tải lại hồ sơ trước khi thử lại.", ...(requestId ? { requestId } : {}) }, { status: 503, headers: requestId ? { ...headers, "X-Request-Id": requestId } : headers });
  }
  return NextResponse.json({ ok: true, licenseEvidenceUrl: evidenceRef, isVerified: latest.is_verified }, { headers });
}
