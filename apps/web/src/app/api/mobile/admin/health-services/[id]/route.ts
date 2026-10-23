import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
const schema = z.object({ status: z.enum(["approved", "rejected", "hidden"]), rejectionReason: z.string().trim().max(1000).optional(), expectedUpdatedAt: z.string().datetime() });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { id } = await context.params; if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã dịch vụ không hợp lệ." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin duyệt không hợp lệ." }, { status: 400 });
  const input = parsed.data;
  if (input.status === "rejected" && !input.rejectionReason?.trim()) return NextResponse.json({ error: "Vui lòng nhập lý do từ chối." }, { status: 400 });
  const supabase = createSupabaseAdminClient(); const { data: current, error: readError } = await supabase.from("health_services").select("id,status,provider_id").eq("id", id).is("archived_at", null).maybeSingle();
  if (readError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/health-services/[id]", operation: "load_service_for_review", error: readError }); return NextResponse.json({ error: "Chưa tải được phiên bản dịch vụ cần duyệt.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  if (!current) return NextResponse.json({ error: "Không tìm thấy dịch vụ." }, { status: 404 });
  if (current.status !== "pending" && input.status !== "hidden") return NextResponse.json({ error: "Chỉ dịch vụ đang chờ duyệt mới được duyệt hoặc từ chối." }, { status: 409 });
  const { data, error } = await supabase.from("health_services").update({ status: input.status, rejection_reason: input.status === "rejected" ? input.rejectionReason?.trim() : null, published_at: input.status === "approved" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id).eq("provider_id", current.provider_id).eq("updated_at", input.expectedUpdatedAt).select("id,status,title,updated_at").maybeSingle();
  if (error) {
    if (error.message.includes("HEALTH_PROVIDER_UNVERIFIED")) return NextResponse.json({ error: "Không thể duyệt: cơ sở hiện chưa được xác minh." }, { status: 403 });
    if (error.message.includes("HEALTH_PROVIDER_LICENSE_REQUIRED")) return NextResponse.json({ error: "Không thể công khai khi chưa có giấy phép và hồ sơ chứng minh." }, { status: 403 });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/health-services/[id]", operation: "review_service", error }); return NextResponse.json({ error: "Chưa xác định được kết quả duyệt dịch vụ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Dịch vụ đã thay đổi sau khi tải. Tải lại để duyệt phiên bản mới nhất." }, { status: 409 });
  return NextResponse.json({ ok: true, service: data });
}
