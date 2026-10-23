import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
const schema = z.object({ serviceId: z.string().uuid(), fullName: z.string().trim().min(2).max(120), phone: z.string().trim().min(9).max(20), desiredDate: z.string().date().optional().or(z.literal("")), preferredTime: z.string().trim().max(60).optional(), contactConsent: z.literal(true) });
const CONSENT_TEXT = "Tôi đồng ý để cơ sở y tế đã chọn liên hệ về yêu cầu dịch vụ và khung giờ mong muốn của tôi.";
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin yêu cầu không hợp lệ." }, { status: 400 });
  const input = parsed.data; const supabase = createSupabaseAdminClient();
  const { data: service, error: serviceError } = await supabase.from("health_services").select("id,provider_id,status,health_providers!inner(is_verified)").eq("id", input.serviceId).maybeSingle();
  if (serviceError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/health/inquiries", operation: "check_service", error: serviceError }); return NextResponse.json({ error: "Chưa xác định được dịch vụ còn nhận yêu cầu không.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  const provider = Array.isArray(service?.health_providers) ? service.health_providers[0] : service?.health_providers;
  if (!service || service.status !== "approved" || !provider?.is_verified) return NextResponse.json({ error: "Dịch vụ không còn nhận yêu cầu." }, { status: 404 });
  const { data, error } = await supabase.from("health_inquiries").insert({ service_id: service.id, provider_id: service.provider_id, full_name: input.fullName, phone: input.phone, desired_date: input.desiredDate || null, preferred_time: input.preferredTime || null, contact_consent: true, consent_text: CONSENT_TEXT }).select("id,status,created_at").single();
  if (error || !data) { const requestId = error ? logSafeSupabaseError({ route: "/api/mobile/health/inquiries", operation: "create_inquiry", error }) : undefined; return NextResponse.json({ error: "Chưa gửi được yêu cầu. Nếu mạng bị gián đoạn, hãy kiểm tra lại trước khi gửi lần nữa.", ...(requestId ? { requestId } : {}) }, { status: 503, headers: requestId ? { "X-Request-Id": requestId } : {} }); }
  return NextResponse.json({ ok: true, inquiry: data }, { status: 201 });
}
