import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PREFERRED_SHIFTS = ["day", "night", "rotating", "flexible"] as const;

function todayInVietnam() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const dateOfBirthSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())
    && date.toISOString().slice(0, 10) === value
    && value <= todayInVietnam();
});

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  dateOfBirth: dateOfBirthSchema.nullable().optional(),
  zalo: z.string().trim().max(24).optional().or(z.literal("")),
  province: z.string().trim().max(100).optional().or(z.literal("")),
  desiredIndustry: z.string().trim().max(120).optional().or(z.literal("")),
  desiredSalaryMin: z.number().int().nonnegative().max(1_000_000_000).nullable().optional(),
  experienceYears: z.number().int().nonnegative().max(70).nullable().optional(),
  preferredShift: z.enum(PREFERRED_SHIFTS).nullable().optional(),
  needsHousing: z.boolean().nullable().optional(),
});

const profileFieldErrors = {
  fullName: "Họ tên cần có từ 2 đến 100 ký tự.",
  dateOfBirth: "Ngày sinh không hợp lệ hoặc không được là ngày trong tương lai.",
  zalo: "Zalo không được vượt quá 24 ký tự.",
  province: "Tỉnh/thành không được vượt quá 100 ký tự.",
  desiredIndustry: "Ngành nghề mong muốn không được vượt quá 120 ký tự.",
  desiredSalaryMin: "Lương tối thiểu phải là số nguyên từ 0 đến 1 tỷ đồng.",
  experienceYears: "Kinh nghiệm phải là số nguyên từ 0 đến 70 năm.",
  preferredShift: "Ca làm mong muốn không hợp lệ. Hãy chọn lại ca làm.",
  needsHousing: "Lựa chọn nhu cầu hỗ trợ nhà ở không hợp lệ.",
} as const;

export async function GET() {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const supabase = createSupabaseAdminClient();
  const { data: user } = await supabase.from("users").select("full_name,phone").eq("id", session.userId).maybeSingle();
  const { data: candidates, error } = await supabase.from("candidates")
    .select("id,full_name,phone,date_of_birth,zalo,province,desired_industry,desired_salary_min,experience_years,preferred_shift,needs_housing")
    .eq("user_id", session.userId).order("created_at", { ascending: false }).limit(1);
  if (error) return NextResponse.json({ error: "Không tải được hồ sơ." }, { status: 500 });
  const profile = candidates?.[0];
  return NextResponse.json({ ok: true, profile: profile ? {
    fullName: profile.full_name, phone: session.phone, dateOfBirth: profile.date_of_birth,
    zalo: profile.zalo,
    province: profile.province, desiredIndustry: profile.desired_industry,
    desiredSalaryMin: profile.desired_salary_min, experienceYears: profile.experience_years,
    preferredShift: profile.preferred_shift, needsHousing: profile.needs_housing,
  } : {
    fullName: user?.full_name || "Công nhân", phone: session.phone, dateOfBirth: null,
    zalo: null, province: null, desiredIndustry: null, desiredSalaryMin: null,
    experienceYears: null, preferredShift: null, needsHousing: null,
  } });
}

export async function PATCH(request: NextRequest) {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof typeof profileFieldErrors, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && field in profileFieldErrors) {
        const key = field as keyof typeof profileFieldErrors;
        fieldErrors[key] = profileFieldErrors[key];
      }
    }
    return NextResponse.json({
      error: Object.keys(fieldErrors).length ? "Vui lòng sửa các trường được đánh dấu." : "Dữ liệu hồ sơ không đúng định dạng.",
      ...(Object.keys(fieldErrors).length ? { fieldErrors } : {}),
    }, { status: 400 });
  }
  const supabase = createSupabaseAdminClient();
  const { data: latest, error: readError } = await supabase.from("candidates")
    .select("id").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (readError) return NextResponse.json({ error: "Không tải được hồ sơ hiện tại." }, { status: 500 });
  const patch = parsed.data;
  const candidatePatch = {
    full_name: patch.fullName,
    phone: session.phone,
    ...(patch.dateOfBirth !== undefined ? { date_of_birth: patch.dateOfBirth } : {}),
    ...(patch.zalo !== undefined ? { zalo: patch.zalo || null } : {}),
    ...(patch.province !== undefined ? { province: patch.province || null } : {}),
    ...(patch.desiredIndustry !== undefined ? { desired_industry: patch.desiredIndustry || null } : {}),
    ...(patch.desiredSalaryMin !== undefined ? { desired_salary_min: patch.desiredSalaryMin } : {}),
    ...(patch.experienceYears !== undefined ? { experience_years: patch.experienceYears } : {}),
    ...(patch.preferredShift !== undefined ? { preferred_shift: patch.preferredShift } : {}),
    ...(patch.needsHousing !== undefined ? { needs_housing: patch.needsHousing } : {}),
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
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { data: deleted, error } = await createSupabaseAdminClient().rpc("delete_candidate_account", { p_user_id: session.userId });
  if (error || deleted !== true) return NextResponse.json({ error: "Không xóa được tài khoản." }, { status: 500 });
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("candidate_session");
  return response;
}
