import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isTrainingProviderUnverifiedError, logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
const schema = z.object({ status: z.enum(["approved", "rejected", "hidden"]), rejectionReason: z.string().trim().max(500).optional() });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.status === "rejected" && !parsed.data.rejectionReason)) return NextResponse.json({ error: "Khi từ chối cần ghi lý do." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: course, error: courseError } = await supabase.from("vocational_courses").select("id,provider_id").eq("id", id).maybeSingle();
  if (courseError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/vocational-courses/[id]", operation: "load_course_before_review", error: courseError });
    return NextResponse.json({ error: "Chưa tải được khóa học để duyệt.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!course) return NextResponse.json({ error: "Không tìm thấy khóa học." }, { status: 404 });

  if (parsed.data.status === "approved") {
    const { data: provider, error: providerError } = await supabase.from("training_providers").select("is_verified").eq("id", course.provider_id).maybeSingle();
    if (providerError) {
      const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/vocational-courses/[id]", operation: "check_provider_before_approval", error: providerError });
      return NextResponse.json({ error: "Chưa xác minh được đơn vị đào tạo. Chưa thể duyệt khóa học.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
    }
    if (!provider?.is_verified) return NextResponse.json({ error: "Cần xác minh đơn vị đào tạo trước khi duyệt khóa học." }, { status: 409 });
  }

  const { data, error } = await supabase.from("vocational_courses").update({ status: parsed.data.status, rejection_reason: parsed.data.status === "rejected" ? parsed.data.rejectionReason : null, published_at: parsed.data.status === "approved" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id).select("id,title,status,rejection_reason").maybeSingle();
  if (error) {
    if (parsed.data.status === "approved" && isTrainingProviderUnverifiedError(error)) return NextResponse.json({ error: "Cần xác minh đơn vị đào tạo trước khi duyệt khóa học." }, { status: 409 });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/vocational-courses/[id]", operation: "update_course_status", error });
    return NextResponse.json({ error: "Chưa cập nhật được trạng thái khóa học.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Không tìm thấy khóa học." }, { status: 404 });
  return NextResponse.json({ ok: true, course: data });
}
