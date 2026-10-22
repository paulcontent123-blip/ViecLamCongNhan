import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getInsuranceProviderSession } from "@/lib/insurance-provider-auth";
import { getInsuranceProviderOrderPaymentByCode, setInsuranceProviderOrderCustomerConfirmed } from "@/lib/payment-orders";

const headers = { "Cache-Control": "private, no-store" };
const patchSchema = z.object({ confirmed: z.boolean() });
type Context = { params: Promise<{ code: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const session = await getInsuranceProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const { code } = await params;
  const payment = await getInsuranceProviderOrderPaymentByCode(code, session.providerId);
  if (!payment) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404, headers });
  return NextResponse.json({ ok: true, payment: { ...payment, title: "Gói tài khoản Đối tác Bảo hiểm" } }, { headers });
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const session = await getInsuranceProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Trạng thái thanh toán không hợp lệ." }, { status: 400, headers });
  const { code } = await params;
  const result = await setInsuranceProviderOrderCustomerConfirmed(code, session.providerId, parsed.data.confirmed);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409, headers });
  return NextResponse.json({ ok: true, payment: { ...result.view, title: "Gói tài khoản Đối tác Bảo hiểm" } }, { headers });
}
