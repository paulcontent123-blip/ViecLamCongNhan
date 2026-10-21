import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isTrainingProviderUnverifiedError, logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
const schema = z.object({ title: z.string().trim().min(3).max(160), occupation: z.string().trim().min(2).max(120), level: z.string().max(40).optional(), description: z.string().trim().min(20).max(10000), requirements: z.string().max(3000).optional(), learningMode: z.enum(["onsite", "online", "hybrid"]), provinceCode: z.string().max(32).optional(), location: z.string().max(200).optional(), startDate: z.string().date().optional(), durationText: z.string().max(80).optional(), tuitionVnd: z.number().int().min(0).nullable().optional(), supportDescription: z.string().max(1000).optional(), certificateName: z.string().max(160).optional(), certificateIssuer: z.string().max(160).optional(), capacity: z.number().int().min(0).nullable().optional(), enrollmentDeadline: z.string().date().optional(), action: z.enum(["save", "submit", "close"]).default("save") });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getTrainingProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin khóa học không hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: current, error: currentError } = await supabase.from("vocational_courses").select("id,status").eq("id", id).eq("provider_id", session.providerId).maybeSingle();
  if (currentError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/training-provider/courses/[id]", operation: "load_course_before_update", error: currentError });
    return NextResponse.json({ error: "Chưa tải được khóa học để cập nhật.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!current) return NextResponse.json({ error: "Không tìm thấy khóa học." }, { status: 404 });
  if (current.status === "approved" && parsed.data.action !== "close") return NextResponse.json({ error: "Khóa học đã duyệt cần gửi duyệt lại sau khi chỉnh sửa." }, { status: 409 });
  const { action, ...input } = parsed.data;
  const status = action === "close" ? "closed" : action === "submit" ? "pending" : current.status === "rejected" ? "draft" : current.status;
  if (status === "pending" || status === "approved") {
    const { data: provider, error: providerError } = await supabase.from("training_providers").select("is_verified").eq("id", session.providerId).maybeSingle();
    if (providerError) {
      const requestId = logSafeSupabaseError({ route: "/api/mobile/training-provider/courses/[id]", operation: "check_provider_verification", error: providerError });
      return NextResponse.json({ error: "Chưa xác minh được quyền gửi khóa học. Vui lòng tải lại.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
    }
    if (!provider?.is_verified) return NextResponse.json({ error: "Đơn vị cần được Admin xác minh trước khi gửi khóa học." }, { status: 403 });
  }
  const { data, error } = await supabase.from("vocational_courses").update({
    title: input.title, occupation: input.occupation, level: input.level || null, description: input.description,
    requirements: input.requirements || null, learning_mode: input.learningMode, province_code: input.provinceCode || null,
    location: input.location || null, start_date: input.startDate || null, duration_text: input.durationText || null,
    tuition_vnd: input.tuitionVnd ?? null, support_description: input.supportDescription || null,
    certificate_name: input.certificateName || null, certificate_issuer: input.certificateIssuer || null,
    capacity: input.capacity ?? null, enrollment_deadline: input.enrollmentDeadline || null, status, updated_at: new Date().toISOString(),
  }).eq("id", id).eq("provider_id", session.providerId).select("id,status,title").maybeSingle();
  if (error) {
    if (isTrainingProviderUnverifiedError(error)) return NextResponse.json({ error: "Đơn vị cần được Admin xác minh trước khi gửi khóa học." }, { status: 403 });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/training-provider/courses/[id]", operation: "update_course", error });
    return NextResponse.json({ error: "Chưa xác nhận được cập nhật khóa học. Vui lòng tải lại trước khi thử lại.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Không tìm thấy khóa học." }, { status: 404 });
  return NextResponse.json({ ok: true, course: data });
}
