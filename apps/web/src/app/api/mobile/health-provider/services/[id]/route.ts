import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getHealthProviderSession } from "@/lib/health-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
const schema = z.object({ category: z.enum(["consultation", "examination", "screening"]), title: z.string().trim().min(3).max(160), specialty: z.string().trim().max(100).optional(), description: z.string().trim().min(20).max(5000), priceLabel: z.string().trim().max(200).optional(), address: z.string().trim().max(300).optional(), provinceCode: z.string().trim().max(32).optional(), openingHours: z.string().trim().max(200).optional(), acceptsBhyt: z.boolean().default(false), submitForReview: z.boolean().default(false) });
const row = (input: z.infer<typeof schema>) => ({ category: input.category, title: input.title, specialty: input.specialty || null, description: input.description, price_label: input.priceLabel || null, address: input.address || null, province_code: input.provinceCode || null, opening_hours: input.openingHours || null, accepts_bhyt: input.acceptsBhyt });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getHealthProviderSession(); if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { id } = await context.params; if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã dịch vụ không hợp lệ." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin dịch vụ không hợp lệ." }, { status: 400 });
  const input = parsed.data; const supabase = createSupabaseAdminClient();
  const { data: provider, error: providerError } = await supabase.from("health_providers").select("is_verified").eq("id", session.providerId).maybeSingle();
  if (providerError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/health-provider/services/[id]", operation: "check_provider", error: providerError }); return NextResponse.json({ error: "Chưa xác định được quyền cập nhật dịch vụ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  if (input.submitForReview && !provider?.is_verified) return NextResponse.json({ error: "Cơ sở cần được Admin xác minh trước khi gửi dịch vụ duyệt." }, { status: 403 });
  const { data: current, error: readError } = await supabase.from("health_services").select("id,status").eq("id", id).eq("provider_id", session.providerId).is("archived_at", null).maybeSingle();
  if (readError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/health-provider/services/[id]", operation: "read_service", error: readError }); return NextResponse.json({ error: "Chưa tải được dịch vụ để cập nhật.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  if (!current) return NextResponse.json({ error: "Không tìm thấy dịch vụ." }, { status: 404 });
  const status = input.submitForReview ? "pending" : current.status === "approved" ? "pending" : current.status === "rejected" ? "draft" : current.status;
  const update = { ...row(input), status, rejection_reason: null, updated_at: new Date().toISOString() } as Record<string, unknown>;
  if (status === "pending") update.published_at = null;
  const { data, error } = await supabase.from("health_services").update(update).eq("id", id).eq("provider_id", session.providerId).select("id,status,title,updated_at").maybeSingle();
  if (error) { const requestId = logSafeSupabaseError({ route: "/api/mobile/health-provider/services/[id]", operation: "update_service", error }); return NextResponse.json({ error: "Chưa xác định được dịch vụ đã lưu hay chưa. Tải lại danh sách trước khi thử lại.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  if (!data) return NextResponse.json({ error: "Dịch vụ vừa được thay đổi. Tải lại danh sách để kiểm tra." }, { status: 409 });
  return NextResponse.json({ ok: true, service: data });
}
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getHealthProviderSession(); if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { id } = await context.params; if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã dịch vụ không hợp lệ." }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().from("health_services").update({ status: "hidden", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("provider_id", session.providerId).is("archived_at", null).select("id,archived_at").maybeSingle();
  if (error) { const requestId = logSafeSupabaseError({ route: "/api/mobile/health-provider/services/[id]", operation: "archive_service", error }); return NextResponse.json({ error: "Chưa xác định được dịch vụ đã ẩn hay chưa. Tải lại danh sách.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  if (!data) return NextResponse.json({ error: "Không tìm thấy dịch vụ đang hoạt động." }, { status: 404 });
  return NextResponse.json({ ok: true, service: data });
}
