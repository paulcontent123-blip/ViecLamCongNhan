import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEmployerSession } from "@/lib/employer-auth";
import { createAccountSubscriptionOrder, createJobAddonOrder, isEmployerVerified } from "@/lib/employer";
import { isPaidAccountTier } from "@/lib/account-tiers";
import { isJobAddon } from "@/lib/packages";
import { isPaymentMethod } from "@/lib/payment-method";

const bodySchema = z.object({
  tier: z.enum(["basic", "premium", "campaign"]),
  paymentMethod: z.string().refine(isPaymentMethod, "Phương thức thanh toán không hợp lệ."),
});

export async function POST(request: NextRequest) {
  const session = await getEmployerSession();
  if (!session) {
    return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  }

  if (!(await isEmployerVerified(session.employerId))) {
    return NextResponse.json(
      { error: "Tài khoản của bạn đang chờ Admin xác minh pháp nhân. Vui lòng chờ xác minh để mua gói." },
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

  const { tier, paymentMethod } = parsed.data;
  const result = isJobAddon(tier)
    ? await createJobAddonOrder(session.employerId, tier, paymentMethod)
    : isPaidAccountTier(tier)
      ? await createAccountSubscriptionOrder(session.employerId, tier, paymentMethod)
      : { error: "Gói không hợp lệ." };

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, order: result.order });
}
