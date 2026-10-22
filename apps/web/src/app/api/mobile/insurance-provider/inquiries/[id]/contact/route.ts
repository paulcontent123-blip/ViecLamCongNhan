import { NextResponse } from "next/server";
import { getInsuranceProviderSession } from "@/lib/insurance-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getInsuranceProviderSession(); if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { id } = await context.params; if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã yêu cầu không hợp lệ." }, { status: 400 });
  const now = new Date(); const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const { data, error } = await createSupabaseAdminClient().rpc("view_insurance_inquiry_contact", { p_provider_id: session.providerId, p_inquiry_id: id, p_period_start: periodStart });
  if (error) {
    const status = error.message.includes("PROVIDER_UNVERIFIED") || error.message.includes("CONTACT_LIMIT") || error.message.includes("CONTACT_NOT_CONSENTED") ? 403 : error.message.includes("NOT_FOUND") ? 404 : 503;
    const message = status === 403 ? (error.message.includes("UNVERIFIED") ? "Đối tác chưa được Admin xác minh." : "Đã hết hạn mức xem liên hệ.") : status === 404 ? "Không tìm thấy yêu cầu." : "Chưa kiểm tra được quyền xem liên hệ. Thông tin liên hệ chưa được cung cấp.";
    const requestId = status === 503 ? logSafeSupabaseError({ route: "/api/mobile/insurance-provider/inquiries/[id]/contact", operation: "view_contact", error }) : undefined;
    return NextResponse.json({ error: message, ...(requestId ? { requestId } : {}) }, { status, headers: requestId ? { "X-Request-Id": requestId, "Cache-Control": "private, no-store" } : { "Cache-Control": "private, no-store" } });
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result.phone !== "string") return NextResponse.json({ error: "Chưa xác nhận được quyền xem liên hệ." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ ok: true, phone: result.phone, email: result.email, viewedCount: result.viewed_count, viewLimit: result.view_limit }, { headers: { "Cache-Control": "private, no-store" } });
}
