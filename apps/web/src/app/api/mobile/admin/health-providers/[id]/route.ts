import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
const schema = z.object({ isVerified: z.boolean(), contactViewLimit: z.number().int().min(0).max(100000), expectedUpdatedAt: z.string().datetime() });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { id } = await context.params; if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã cơ sở y tế không hợp lệ." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin xác minh không hợp lệ." }, { status: 400 });
  const input = parsed.data; const { data, error } = await createSupabaseAdminClient().from("health_providers").update({ is_verified: input.isVerified, contact_view_limit: input.contactViewLimit, updated_at: new Date().toISOString() }).eq("id", id).eq("updated_at", input.expectedUpdatedAt).select("id,provider_name,is_verified,contact_view_limit,updated_at,license_number,license_evidence_url").maybeSingle();
  if (error) {
    if (error.message.includes("HEALTH_PROVIDER_LICENSE_REQUIRED")) return NextResponse.json({ error: "Chưa thể xác minh: cơ sở cần khai số giấy phép và URL hồ sơ chứng minh." }, { status: 409 });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/health-providers/[id]", operation: "update_verification_and_quota", error }); return NextResponse.json({ error: "Chưa xác định được cập nhật cơ sở đã lưu hay chưa.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Cơ sở đã thay đổi trong lúc xử lý. Tải lại danh sách rồi thử lại." }, { status: 409 });
  return NextResponse.json({ ok: true, provider: data });
}
