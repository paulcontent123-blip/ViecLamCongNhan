import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  zalo: z.string().trim().max(24).optional().or(z.literal("")),
  province: z.string().trim().max(100).optional().or(z.literal("")),
  desiredIndustry: z.string().trim().max(120).optional().or(z.literal("")),
  desiredSalaryMin: z.number().int().nonnegative().max(1_000_000_000).nullable().optional(),
  experienceYears: z.number().int().nonnegative().max(70).nullable().optional(),
});

export async function GET() {
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const supabase = createSupabaseAdminClient();
  const { data: user } = await supabase.from("users").select("full_name,phone").eq("id", session.userId).maybeSingle();
  const { data: candidates, error } = await supabase.from("candidates")
    .select("id,full_name,phone,zalo,province,desired_industry,desired_salary_min,experience_years")
    .eq("user_id", session.userId).order("created_at", { ascending: false }).limit(1);
  if (error) return NextResponse.json({ error: "Không tải được hồ sơ." }, { status: 500 });
  const profile = candidates?.[0];
  return NextResponse.json({ ok: true, profile: profile ? {
    fullName: profile.full_name, phone: session.phone, zalo: profile.zalo,
    province: profile.province, desiredIndustry: profile.desired_industry,
    desiredSalaryMin: profile.desired_salary_min, experienceYears: profile.experience_years,
  } : { fullName: user?.full_name || "Công nhân", phone: session.phone, zalo: null, province: null, desiredIndustry: null, desiredSalaryMin: null, experienceYears: null } });
}

export async function PATCH(request: NextRequest) {
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin hồ sơ chưa hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: latest, error: readError } = await supabase.from("candidates")
    .select("id").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (readError) return NextResponse.json({ error: "Không tải được hồ sơ hiện tại." }, { status: 500 });
  const patch = parsed.data;
  const candidatePatch = {
    full_name: patch.fullName,
    phone: session.phone,
    ...(patch.zalo !== undefined ? { zalo: patch.zalo || null } : {}),
    ...(patch.province !== undefined ? { province: patch.province || null } : {}),
    ...(patch.desiredIndustry !== undefined ? { desired_industry: patch.desiredIndustry || null } : {}),
    ...(patch.desiredSalaryMin !== undefined ? { desired_salary_min: patch.desiredSalaryMin } : {}),
    ...(patch.experienceYears !== undefined ? { experience_years: patch.experienceYears } : {}),
  };
  if (latest) {
    const { error } = await supabase.from("candidates").update(candidatePatch).eq("id", latest.id).eq("user_id", session.userId);
    if (error) return NextResponse.json({ error: "Không lưu được hồ sơ." }, { status: 500 });
  } else {
    const { error } = await supabase.from("candidates").insert({ ...candidatePatch, user_id: session.userId, source: "worker_profile" });
    if (error) return NextResponse.json({ error: "Không tạo được hồ sơ." }, { status: 500 });
  }
  await supabase.from("users").update({ full_name: patch.fullName }).eq("id", session.userId);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { data: deleted, error } = await createSupabaseAdminClient().rpc("delete_candidate_account", { p_user_id: session.userId });
  if (error || deleted !== true) return NextResponse.json({ error: "Không xóa được tài khoản." }, { status: 500 });
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("candidate_session");
  return response;
}
