import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCandidateSession } from "@/lib/candidate-auth";

const schema = z.object({ courseId: z.string().uuid(), fullName: z.string().trim().min(2).max(120), phone: z.string().trim().min(9).max(20), email: z.string().trim().email().max(254).optional().or(z.literal("")), message: z.string().trim().max(1000).optional() });
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin yêu cầu không hợp lệ." }, { status: 400 });
  const input = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data: course } = await supabase.from("vocational_courses").select("id,provider_id,status,training_providers!inner(is_verified)")
    .eq("id", input.courseId).eq("status", "approved").eq("training_providers.is_verified", true).maybeSingle();
  if (!course) return NextResponse.json({ error: "Khóa học hiện không nhận yêu cầu." }, { status: 404 });
  const candidate = await getCandidateSession().catch(() => null);
  const phone = input.phone.replace(/\D/g, "");
  if (!/^\d{9,12}$/.test(phone)) return NextResponse.json({ error: "Số điện thoại không hợp lệ." }, { status: 400 });
  const { data, error } = await supabase.from("vocational_inquiries").insert({
    course_id: course.id, provider_id: course.provider_id, user_id: candidate?.userId || null,
    full_name: input.fullName, phone, email: input.email || null, message: input.message || null,
  }).select("id").single();
  if (error?.code === "23505") return NextResponse.json({ error: "Số điện thoại này đã gửi yêu cầu cho khóa học." }, { status: 409 });
  if (error || !data) return NextResponse.json({ error: "Chưa gửi được yêu cầu. Vui lòng thử lại." }, { status: 500 });
  return NextResponse.json({ ok: true, inquiryId: data.id }, { status: 201 });
}
