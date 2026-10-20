import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEmployerSession } from "@/lib/employer-auth";
import { getOrderPaymentByCode, setOrderCustomerConfirmed } from "@/lib/payment-orders";

/** Xem lại màn hình thanh toán của một đơn (QR + thông tin nhận tiền + trạng thái). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getEmployerSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const { code } = await params;
  const payment = await getOrderPaymentByCode(code.toUpperCase(), session.employerId);
  if (!payment) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  return NextResponse.json({ ok: true, payment });
}

const bodySchema = z.object({ confirmed: z.boolean() });

/** NTD tự báo "Tôi đã thanh toán" hoặc hoàn tác (chỉ khi Admin chưa đối soát xong). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getEmployerSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });

  const { code } = await params;
  const result = await setOrderCustomerConfirmed(code.toUpperCase(), session.employerId, parsed.data.confirmed);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true, payment: result.view });
}
