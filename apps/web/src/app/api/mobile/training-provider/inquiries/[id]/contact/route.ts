import { NextResponse } from "next/server";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getTrainingProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { id } = await context.params;
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const { data, error } = await createSupabaseAdminClient().rpc("view_vocational_inquiry_contact", { p_provider_id: session.providerId, p_inquiry_id: id, p_period_start: periodStart });
  if (error) {
    const code = error.message.includes("PROVIDER_UNVERIFIED") ? 403 : error.message.includes("CONTACT_LIMIT") ? 403 : error.message.includes("NOT_FOUND") ? 404 : 500;
    const message = code === 403 ? (error.message.includes("UNVERIFIED") ? "Đơn vị chưa được xác minh." : "Đã hết hạn mức xem liên hệ.") : code === 404 ? "Không tìm thấy yêu cầu." : "Chưa kiểm tra được hạn mức. Thông tin liên hệ chưa được cung cấp.";
    return NextResponse.json({ error: message }, { status: code });
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result.phone !== "string") return NextResponse.json({ error: "Chưa xác nhận được quyền xem liên hệ." }, { status: 500 });
  return NextResponse.json({ ok: true, phone: result.phone, email: result.email, viewedCount: result.viewed_count, viewLimit: result.view_limit });
}
