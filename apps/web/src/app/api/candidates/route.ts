import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { candidatePhoneVariants, getCandidateSession, normalizeCandidatePhone } from "@/lib/candidate-auth";

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
  const session = await getCandidateSession();
  const normalizedPhone = normalizeCandidatePhone(phone);
  const variants = normalizedPhone ? candidatePhoneVariants(normalizedPhone) : [phone];

  // A verified phone is owned by its signed-in candidate account. Guest requests
  // cannot use confirmReplace to erase that person's profile or applications.
  const { data: verifiedOwner, error: ownerError } = await supabase.from("users")
    .select("id,role,is_verified,status").in("phone", variants).maybeSingle();
  if (ownerError) return NextResponse.json({ error: "Không kiểm tra được tài khoản công nhân." }, { status: 500 });
  if (verifiedOwner?.role === "candidate" && verifiedOwner.is_verified && verifiedOwner.status === "active" &&
    (!session || session.userId !== verifiedOwner.id || session.phone !== normalizedPhone)) {
    return NextResponse.json({ error: "Số điện thoại này đã được xác minh. Chủ tài khoản cần đăng nhập để cập nhật hồ sơ." }, { status: 403 });
  }
  if (session && (!normalizedPhone || session.phone !== normalizedPhone)) {
    return NextResponse.json({ error: "Số điện thoại gửi hồ sơ phải trùng với tài khoản đã xác minh." }, { status: 403 });
  }

  // Chỉ cho 1 hồ sơ/SĐT: nếu SĐT này đã tồn tại và ứng viên chưa xác nhận ghi đè,
  // trả về 409 để client hỏi xác nhận trước ‑ không ghi gì vào DB ở bước này.
  const { data: existingRows, error: existingError } = await supabase
    .from("candidates")
    .select("id, source, user_id")
    .in("phone", variants)
    .order("created_at", { ascending: false });

  if (existingError) {
    return NextResponse.json({ error: "Không kiểm tra được thông tin, thử lại sau." }, { status: 500 });
  }

  const ownRows = session ? (existingRows || []).filter(row => row.user_id === session.userId) : [];
  let candidateId: string | null = null;

  // A verified account edits its latest own record in place. This preserves
  // applications and the employer's status history instead of cascading deletes.
  if (session && ownRows.length > 0) {
    candidateId = ownRows[0].id;
    const { error: updateError } = await supabase.from("candidates").update({
      full_name: fullName,
      phone: normalizedPhone,
      zalo: zalo || null,
      province: province || null,
      desired_industry: desiredIndustry || null,
      desired_salary_min: desiredSalaryMin ? desiredSalaryMin * 1_000_000 : null,
      experience_years: experienceYears ?? null,
      source: jobSlug ? "job_apply" : "quick_form",
    }).eq("id", candidateId).eq("user_id", session.userId);
    if (updateError) return NextResponse.json({ error: "Không cập nhật được hồ sơ, thử lại sau." }, { status: 500 });
  } else if (existingRows && existingRows.length > 0 && !session) {
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

    const { error: deleteError } = await supabase.from("candidates").delete().in("id", existingIds);
    if (deleteError) return NextResponse.json({ error: "Không thay được hồ sơ cũ, thử lại sau." }, { status: 500 });

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

  if (!candidateId) {
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .insert({
        full_name: fullName,
        phone: normalizedPhone || phone,
        zalo: zalo || null,
        province: province || null,
        desired_industry: desiredIndustry || null,
        // Form inputs salary in millions, while the database stores full VND.
        desired_salary_min: desiredSalaryMin ? desiredSalaryMin * 1_000_000 : null,
        experience_years: experienceYears ?? null,
        source: jobSlug ? "job_apply" : "quick_form",
        ...(session ? { user_id: session.userId } : {}),
      })
      .select("id")
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json({ error: "Không lưu được thông tin, thử lại sau." }, { status: 500 });
    }
    candidateId = candidate.id;
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
      const { data: priorApplication, error: priorError } = await supabase.from("applications")
        .select("id").eq("job_id", job.id).eq("candidate_id", candidateId).maybeSingle();
      if (priorError) return NextResponse.json({ error: "Không kiểm tra được đơn ứng tuyển hiện có." }, { status: 500 });
      if (priorApplication) appliedJobTitle = job.title;
      else {
        const { error: applicationError } = await supabase.from("applications").insert({
          job_id: job.id,
          candidate_id: candidateId,
          employer_id: job.employer_id,
        });
        if (applicationError) return NextResponse.json({ error: "Không lưu được đơn ứng tuyển." }, { status: 500 });
        await supabase.from("jobs").update({ apply_count: job.apply_count + 1 }).eq("id", job.id);
        appliedJobTitle = job.title;
      }
    }
  }

  return NextResponse.json({ ok: true, candidateId, appliedJobTitle });
}
