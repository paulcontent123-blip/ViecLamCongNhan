import { NextRequest, NextResponse } from "next/server";
import { getRentalProviderSession } from "@/lib/rental-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Context) {
  const session = await getRentalProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Hồ sơ người thuê không hợp lệ." }, { status: 400, headers });
  const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);
  const { data, error } = await createSupabaseAdminClient().rpc("view_rental_provider_tenant_contact", {
    p_provider_id: session.providerId, p_candidate_id: id, p_period_start: periodStart,
  });
  if (error) {
    const message = error.message || "";
    if (message.includes("PROVIDER_UNVERIFIED")) return NextResponse.json({ error: "Đối tác chưa được Admin xác minh." }, { status: 403, headers });
    if (message.includes("CANDIDATE_NOT_AVAILABLE")) return NextResponse.json({ error: "Hồ sơ không còn được chia sẻ với Chủ trọ." }, { status: 404, headers });
    if (message.includes("CONTACT_LIMIT")) return NextResponse.json({ error: "Đã hết lượt xem liên hệ trong tháng này." }, { status: 403, headers });
    console.error("POST /api/mobile/rental-provider/candidates/[id]/contact failed:", error);
    return NextResponse.json({ error: "Chưa xác định được lượt xem liên hệ đã ghi nhận hay chưa. Tải lại hạn mức trước khi thao tác lại." }, { status: 503, headers });
  }
  const contact = Array.isArray(data) ? data[0] : null;
  if (!contact || typeof contact.phone !== "string" || !Number.isSafeInteger(contact.viewed_count) || !Number.isSafeInteger(contact.view_limit)) {
    return NextResponse.json({ error: "Chưa xác nhận được quyền xem liên hệ." }, { status: 503, headers });
  }
  return NextResponse.json({ ok: true, phone: contact.phone, zalo: contact.zalo || null, viewedCount: contact.viewed_count, viewLimit: contact.view_limit }, { headers });
}
