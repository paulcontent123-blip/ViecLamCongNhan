import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEmployerSession } from "@/lib/employer-auth";
import { createEmployerBlast, isEmployerVerified } from "@/lib/employer";
import { isPaymentMethod } from "@/lib/payment-method";

const bodySchema = z.object({
  campaignName: z.string().min(3, "Vui lòng nhập tên chiến dịch"),
  channel: z.enum(["sms", "zalo", "combo"]),
  message: z.string().min(10, "Nội dung tin nhắn quá ngắn").max(160, "Tối đa 160 ký tự"),
  targetProvince: z.string().optional(),
  targetIndustry: z.string().optional(),
  quantity: z.coerce.number().int().min(1).optional(),
  paymentMethod: z.string().refine(isPaymentMethod, "Phương thức thanh toán không hợp lệ."),
});

export async function POST(request: NextRequest) {
  const session = await getEmployerSession();
  if (!session) {
    return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  }

  if (!(await isEmployerVerified(session.employerId))) {
    return NextResponse.json(
      { error: "Tài khoản của bạn đang chờ Admin xác minh pháp nhân. Vui lòng chờ xác minh để gửi Blast." },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const { paymentMethod, ...blastInput } = parsed.data;
  const result = await createEmployerBlast(session.employerId, blastInput, paymentMethod);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...result });
}
