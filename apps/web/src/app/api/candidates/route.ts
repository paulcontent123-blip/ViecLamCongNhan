import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  fullName: z.string().min(2, "Vui lòng nhập họ tên"),
  phone: z.string().min(9, "Số điện thoại không hợp lệ"),
  zalo: z.string().optional().or(z.literal("")),
  province: z.string().optional().or(z.literal("")),
  desiredIndustry: z.string().optional().or(z.literal("")),
  desiredSalaryMin: z.coerce.number().optional(),
  experienceYears: z.coerce.number().optional(),
  jobSlug: z.string().optional().or(z.literal("")),
  // true khi ứng viên đã xác nhận muốn xóa hồ sơ cũ (cùng SĐT) để ghi thông tin mới.
  confirmReplace: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }
  const {
    fullName,
    phone,
    zalo,
    province,
    desiredIndustry,
    desiredSalaryMin,
    experienceYears,
    jobSlug,
    confirmReplace,
  } = parsed.data;

  const supabase = createSupabaseAdminClient();

  // Chỉ cho 1 hồ sơ/SĐT: nếu SĐT này đã tồn tại và ứng viên chưa xác nhận ghi đè,
  // trả về 409 để client hỏi xác nhận trước — không ghi gì vào DB ở bước này.
  const { data: existingRows, error: existingError } = await supabase
    .from("candidates")
    .select("id, source")
    .eq("phone", phone)
    .order("created_at", { ascending: false });

  if (existingError) {
    return NextResponse.json({ error: "Không kiểm tra được thông tin, thử lại sau." }, { status: 500 });
  }

  if (existingRows && existingRows.length > 0) {
    if (!confirmReplace) {
      return NextResponse.json(
        {
          conflict: true,
          existingSource: existingRows[0].source as "quick_form" | "job_apply",
        },
        { status: 409 },
      );
    }

    // Đã xác nhận ghi đè: xóa hồ sơ cũ (cascade xóa luôn application liên kết),
    // đồng thời trừ lại apply_count của (các) tin đã ứng tuyển trước đó cho khớp
    // số đơn ứng tuyển thật còn tồn tại.
    const existingIds = existingRows.map((r) => r.id);
    const { data: oldApplications } = await supabase
      .from("applications")
      .select("job_id")
      .in("candidate_id", existingIds);

    await supabase.from("candidates").delete().in("id", existingIds);

    if (oldApplications && oldApplications.length > 0) {
      const jobIdCounts = new Map<string, number>();
      for (const app of oldApplications) {
        if (app.job_id) jobIdCounts.set(app.job_id, (jobIdCounts.get(app.job_id) ?? 0) + 1);
      }
      for (const [jobId, count] of jobIdCounts) {
        const { data: job } = await supabase.from("jobs").select("apply_count").eq("id", jobId).maybeSingle();
        if (job) {
          await supabase
            .from("jobs")
            .update({ apply_count: Math.max(0, job.apply_count - count) })
            .eq("id", jobId);
        }
      }
    }
  }

  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .insert({
      full_name: fullName,
      phone,
      zalo: zalo || null,
      province: province || null,
      desired_industry: desiredIndustry || null,
      // Form nhập theo đơn vị "triệu/tháng" (VD: 10) nhưng cột lưu VNĐ đầy đủ, khớp
      // đơn vị với jobs.salary_min/salary_max và cách hiển thị ở admin/ung-vien
      // (chia lại cho 1_000_000 để ra "Xtr+") — thiếu bước nhân này thì lưu sai 1 triệu lần.
      desired_salary_min: desiredSalaryMin ? desiredSalaryMin * 1_000_000 : null,
      experience_years: experienceYears ?? null,
      source: jobSlug ? "job_apply" : "quick_form",
    })
    .select("id")
    .single();

  if (candidateError || !candidate) {
    return NextResponse.json({ error: "Không lưu được thông tin, thử lại sau." }, { status: 500 });
  }

  let appliedJobTitle: string | null = null;

  if (jobSlug) {
    const { data: job } = await supabase
      .from("jobs")
      .select("id, title, employer_id, apply_count")
      .eq("slug", jobSlug)
      .eq("status", "approved")
      .maybeSingle();

    if (job) {
      await supabase.from("applications").insert({
        job_id: job.id,
        candidate_id: candidate.id,
        employer_id: job.employer_id,
      });
      await supabase.from("jobs").update({ apply_count: job.apply_count + 1 }).eq("id", job.id);
      appliedJobTitle = job.title;
    }
  }

  return NextResponse.json({ ok: true, candidateId: candidate.id, appliedJobTitle });
}
