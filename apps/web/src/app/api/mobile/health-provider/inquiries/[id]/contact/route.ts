import { NextRequest, NextResponse } from "next/server";
import { getHealthProviderSession } from "@/lib/health-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
const expectedErrors: Record<string, [number, string]> = { HEALTH_PROVIDER_NOT_FOUND: [404, "Không tìm thấy cơ sở y tế."], HEALTH_PROVIDER_UNVERIFIED: [403, "Cơ sở cần được Admin xác minh mới được mở thông tin liên hệ."], HEALTH_INQUIRY_NOT_AVAILABLE: [404, "Yêu cầu không tồn tại hoặc chưa đồng ý cho cơ sở liên hệ."], HEALTH_CONTACT_LIMIT: [403, "Cơ sở đã hết hạn mức mở liên hệ tháng này."] };
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getHealthProviderSession(); if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { id } = await context.params; if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã yêu cầu không hợp lệ." }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().rpc("view_health_inquiry_contact", { p_provider_id: session.providerId, p_inquiry_id: id });
  if (error) {
    const match = Object.entries(expectedErrors).find(([code]) => error.message.includes(code));
    if (match) return NextResponse.json({ error: match[1][1] }, { status: match[1][0] });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/health-provider/inquiries/[id]/contact", operation: "view_contact", error });
    return NextResponse.json({ error: "Chưa xác định được lượt mở liên hệ đã ghi nhận chưa. Tải lại yêu cầu trước khi thử tiếp.", requestId }, { status: 503, headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store" } });
  }
  const contact = Array.isArray(data) ? data[0] : data;
  if (!contact || typeof contact.phone !== "string" || !Number.isSafeInteger(contact.viewed_count) || !Number.isSafeInteger(contact.view_limit)) return NextResponse.json({ error: "Phản hồi quyền liên hệ không hợp lệ." }, { status: 503 });
  return NextResponse.json({ ok: true, fullName: contact.full_name, phone: contact.phone, viewedCount: contact.viewed_count, viewLimit: contact.view_limit }, { headers: { "Cache-Control": "private, no-store" } });
}
