import { NextResponse } from "next/server";
import { getRentalProviderSession } from "@/lib/rental-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getRentalProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { id } = await context.params;
  const now = new Date();
  const periodStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const { data, error } = await createSupabaseAdminClient().rpc("view_rental_inquiry_contact", {
    p_provider_id: session.providerId, p_inquiry_id: id, p_period_start: periodStart,
  });
  if (error) {
    const message = error.message || "";
    if (message.includes("RENTAL_CONTACT_LIMIT")) return NextResponse.json({ error: "Đã dùng hết lượt xem liên hệ của gói hiện tại. Nâng cấp gói để xem thêm." }, { status: 403 });
    if (message.includes("RENTAL_PROVIDER_UNVERIFIED")) return NextResponse.json({ error: "Đơn vị cần được Admin xác minh trước khi xem liên hệ." }, { status: 403 });
    if (message.includes("RENTAL_INQUIRY_NOT_FOUND")) return NextResponse.json({ error: "Không tìm thấy yêu cầu thuộc đơn vị." }, { status: 404 });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/inquiries/[id]/contact", operation: "view_rental_inquiry_contact", error });
    return NextResponse.json({ error: "Chưa xác định được quyền xem liên hệ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result.phone !== "string") return NextResponse.json({ error: "Phản hồi quyền liên hệ không hợp lệ." }, { status: 503 });
  return NextResponse.json({ ok: true, phone: result.phone, email: result.email, usage: { viewedCount: result.viewed_count, viewLimit: result.view_limit } });
}
