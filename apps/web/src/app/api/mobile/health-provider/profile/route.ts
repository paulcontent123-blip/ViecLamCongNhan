import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getHealthProviderSession } from "@/lib/health-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
const headers = { "Cache-Control": "private, no-store" };
const secureEvidenceUrl = z.string().trim().url().max(1000).refine(value => value.startsWith("https://"), "URL hồ sơ chứng minh phải dùng HTTPS.").optional().or(z.literal(""));
const schema = z.object({ providerName: z.string().trim().min(2).max(160), providerType: z.enum(["hospital", "clinic", "medical_center"]), contactName: z.string().trim().min(2).max(120), contactPhone: z.string().trim().min(9).max(20), provinceCode: z.string().trim().max(32).optional(), address: z.string().trim().max(300).optional(), taxCode: z.string().trim().max(32).optional(), licenseNumber: z.string().trim().max(80).optional(), licenseEvidenceUrl: secureEvidenceUrl, description: z.string().trim().max(2000).optional() });
export async function GET() {
  const session = await getHealthProviderSession(); if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const { data, error } = await createSupabaseAdminClient().from("health_providers").select("id,provider_name,provider_slug,provider_type,contact_name,contact_phone,province_code,address,tax_code,license_number,license_evidence_url,description,logo_url,is_verified,contact_view_limit,created_at,updated_at").eq("id", session.providerId).maybeSingle();
  if (error) { const requestId = logSafeSupabaseError({ route: "/api/mobile/health-provider/profile", operation: "load_profile", error }); return NextResponse.json({ error: "Chưa tải được hồ sơ cơ sở y tế.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } }); }
  if (!data) return NextResponse.json({ error: "Không tìm thấy hồ sơ cơ sở y tế." }, { status: 404, headers });
  return NextResponse.json({ ok: true, provider: data, email: session.email }, { headers });
}
export async function PATCH(request: NextRequest) {
  const session = await getHealthProviderSession(); if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin hồ sơ không hợp lệ." }, { status: 400, headers });
  const input = parsed.data; const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("update_health_provider_profile_atomically", { p_provider_id: session.providerId, p_user_id: session.userId, p_provider_name: input.providerName, p_provider_type: input.providerType, p_contact_name: input.contactName, p_contact_phone: input.contactPhone, p_province_code: input.provinceCode?.trim() || null, p_address: input.address?.trim() || null, p_tax_code: input.taxCode?.trim() || null, p_license_number: input.licenseNumber?.trim() || null, p_license_evidence_url: input.licenseEvidenceUrl?.trim() || null, p_description: input.description?.trim() || null });
  if (error) { const requestId = logSafeSupabaseError({ route: "/api/mobile/health-provider/profile", operation: "update_profile", error }); return NextResponse.json({ error: "Chưa xác định được hồ sơ đã lưu hay chưa. Tải lại hồ sơ trước khi thử lại.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } }); }
  if (data !== true) return NextResponse.json({ error: "Không thể cập nhật hồ sơ của phiên đăng nhập này." }, { status: 403, headers });
  const { data: profile, error: readError } = await supabase.from("health_providers").select("is_verified,updated_at").eq("id", session.providerId).maybeSingle();
  if (readError || !profile) { const requestId = readError ? logSafeSupabaseError({ route: "/api/mobile/health-provider/profile", operation: "verify_profile_update", error: readError }) : undefined; return NextResponse.json({ error: "Chưa xác định được hồ sơ đã lưu hay chưa. Tải lại hồ sơ trước khi thử lại.", ...(requestId ? { requestId } : {}) }, { status: 503, headers: { ...headers, ...(requestId ? { "X-Request-Id": requestId } : {}) } }); }
  return NextResponse.json({ ok: true, profile }, { headers });
}
