import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEmployerSession } from "@/lib/employer-auth";
import { isEmployerVerified, updateEmployerCampaign } from "@/lib/employer";
import { isCampaignTheme } from "@/lib/campaign-theme";

const bodySchema = z.object({
  theme: z.string().refine(isCampaignTheme, "Theme không hợp lệ."),
  story: z.string().max(2000, "Tối đa 2000 ký tự.").optional().or(z.literal("")),
  title: z.string().min(5, "Tiêu đề tối thiểu 5 ký tự"),
  description: z.string().min(20, "Mô tả công việc tối thiểu 20 ký tự"),
  requirements: z.string().optional(),
  salaryMin: z.coerce.number().optional(),
  salaryMax: z.coerce.number().optional(),
  jobType: z.enum(["full_time", "part_time", "seasonal"]).optional(),
  provinceCode: z.string().min(1, "Vui lòng chọn tỉnh/thành"),
  district: z.string().optional(),
  industry: z.string().min(1, "Vui lòng chọn ngành nghề"),
  quantity: z.coerce.number().int().min(1).optional(),
  isUrgent: z.boolean().optional(),
  hasHousing: z.boolean().optional(),
  hasShuttle: z.boolean().optional(),
  hasMeals: z.boolean().optional(),
  noExperienceRequired: z.boolean().optional(),
  shiftType: z.enum(["day", "night", "rotating"]).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getEmployerSession();
  if (!session) {
    return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  }
  if (!(await isEmployerVerified(session.employerId))) {
    return NextResponse.json({ error: "Tài khoản của bạn đang chờ Admin xác minh pháp nhân." }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const ok = await updateEmployerCampaign(session.employerId, id, parsed.data);
  if (!ok) {
    return NextResponse.json({ error: "Không cập nhật được chiến dịch, thử lại sau." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
