import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { isTrainingProviderUnverifiedError, logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({ title: z.string().trim().min(3).max(160), occupation: z.string().trim().min(2).max(120), level: z.string().max(40).optional(), description: z.string().trim().min(20).max(10000), requirements: z.string().max(3000).optional(), learningMode: z.enum(["onsite", "online", "hybrid"]).default("onsite"), provinceCode: z.string().max(32).optional(), location: z.string().max(200).optional(), startDate: z.string().date().optional(), durationText: z.string().max(80).optional(), tuitionVnd: z.number().int().min(0).nullable().optional(), supportDescription: z.string().max(1000).optional(), certificateName: z.string().max(160).optional(), certificateIssuer: z.string().max(160).optional(), capacity: z.number().int().min(0).nullable().optional(), enrollmentDeadline: z.string().date().optional() });
const row = (input: z.infer<typeof schema>) => ({ title: input.title, occupation: input.occupation, level: input.level || null, description: input.description, requirements: input.requirements || null, learning_mode: input.learningMode, province_code: input.provinceCode || null, location: input.location || null, start_date: input.startDate || null, duration_text: input.durationText || null, tuition_vnd: input.tuitionVnd ?? null, support_description: input.supportDescription || null, certificate_name: input.certificateName || null, certificate_issuer: input.certificateIssuer || null, capacity: input.capacity ?? null, enrollment_deadline: input.enrollmentDeadline || null });
export async function GET(request: NextRequest) {
  const session = await getTrainingProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  let paging;
  try { paging = parseEmployerListParams(request.nextUrl.searchParams, ["draft", "pending", "approved", "rejected", "hidden", "closed"]); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số phân trang không hợp lệ." }, { status: 400 }); }
  const { page, pageSize, status } = paging;
  const params = request.nextUrl.searchParams;
  let query = createSupabaseAdminClient().from("vocational_courses").select("*", { count: "exact" }).eq("provider_id", session.providerId).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (status) query = query.eq("status", status);
  const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._(),]/g, " ");
  if (q) query = query.or(`title.ilike.%${q}%,occupation.ilike.%${q}%`);
  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return NextResponse.json({ error: "Chưa tải được khóa học của đơn vị." }, { status: 500 });
  const total = count || 0;
  return NextResponse.json({ ok: true, items: data || [], total, page, pageSize, hasMore: page * pageSize < total });
}
export async function POST(request: NextRequest) {
  const session = await getTrainingProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin khóa học không hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: provider, error: providerError } = await supabase.from("training_providers").select("is_verified").eq("id", session.providerId).maybeSingle();
  if (providerError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/training-provider/courses", operation: "check_provider_verification", error: providerError });
    return NextResponse.json({ error: "Chưa xác minh được quyền gửi khóa học. Vui lòng thử tải lại.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!provider?.is_verified) return NextResponse.json({ error: "Đơn vị cần được Admin xác minh trước khi gửi khóa học." }, { status: 403 });
  const { data, error } = await supabase.from("vocational_courses").insert({ ...row(parsed.data), provider_id: session.providerId, status: "pending" }).select("id,status,title").single();
  if (error) {
    if (isTrainingProviderUnverifiedError(error)) return NextResponse.json({ error: "Đơn vị cần được Admin xác minh trước khi gửi khóa học." }, { status: 403 });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/training-provider/courses", operation: "submit_course", error });
    return NextResponse.json({ error: "Chưa gửi được khóa học để duyệt.", requestId }, { status: 500, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Chưa gửi được khóa học để duyệt." }, { status: 500 });
  return NextResponse.json({ ok: true, course: data }, { status: 201 });
}
