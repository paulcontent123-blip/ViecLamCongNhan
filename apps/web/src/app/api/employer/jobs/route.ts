import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEmployerSession } from "@/lib/employer-auth";
import { createEmployerJob, isEmployerVerified } from "@/lib/employer";
import { isPaymentMethod } from "@/lib/payment-method";

const VERIFICATION_REQUIRED_ERROR =
  "Tài khoản của bạn đang chờ Admin xác minh pháp nhân. Vui lòng chờ xác minh để đăng tin.";

const bodySchema = z
  .object({
    title: z.string().min(5, "Tiêu đề tối thiểu 5 ký tự"),
    description: z.string().min(20, "Mô tả công việc tối thiểu 20 ký tự"),
    requirements: z.string().optional(),
    salaryMin: z.coerce.number().optional(),
    salaryMax: z.coerce.number().optional(),
    jobType: z.enum(["full_time", "part_time", "seasonal"]).optional(),
    provinceCode: z.string().min(1, "Vui lòng chọn tỉnh/thành"),
    district: z.string().optional(),
    kcnId: z.string().uuid().optional(),
    industry: z.string().min(1, "Vui lòng chọn ngành nghề"),
    quantity: z.coerce.number().int().min(1).optional(),
    wantsCampaign: z.boolean().optional(),
    campaignMessage: z.string().trim().max(1000, "Tối đa 1000 ký tự.").optional(),
    paymentMethod: z.string().refine(isPaymentMethod, "Phương thức thanh toán không hợp lệ.").optional(),
    isUrgent: z.boolean().optional(),
    hasHousing: z.boolean().optional(),
    hasShuttle: z.boolean().optional(),
    hasMeals: z.boolean().optional(),
    noExperienceRequired: z.boolean().optional(),
    shiftType: z.enum(["day", "night", "rotating"]).optional(),
  })
  .refine((data) => !data.wantsCampaign || (data.campaignMessage?.length ?? 0) >= 10, {
    message: "Vui lòng nhập nội dung tin nhắn Zalo gửi ứng viên (tối thiểu 10 ký tự).",
    path: ["campaignMessage"],
  })
  .refine((data) => !data.wantsCampaign || !!data.paymentMethod, {
    message: "Vui lòng chọn phương thức thanh toán cho gói Chiến dịch.",
    path: ["paymentMethod"],
  });

export async function POST(request: NextRequest) {
  const session = await getEmployerSession();
  if (!session) {
    return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  }

  if (!(await isEmployerVerified(session.employerId))) {
    return NextResponse.json({ error: VERIFICATION_REQUIRED_ERROR }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const result = await createEmployerJob(session.employerId, parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.uncertain ? 503 : 400 });
  }

  return NextResponse.json({ ok: true, job: result.job, order: result.order, payment: result.payment });
}
