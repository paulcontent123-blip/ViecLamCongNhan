import { NextResponse } from "next/server";
import { getEmployerSession } from "@/lib/employer-auth";
import { getActivePaymentAccount, isMomoAvailable } from "@/lib/payment-orders";

/** Phương thức đang mở ở màn hình thanh toán: VietQR khi Admin đã bật tài khoản, MoMo khi đã bật ví. */
export async function GET() {
  const session = await getEmployerSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const [account, momo] = await Promise.all([getActivePaymentAccount(), isMomoAvailable()]);
  return NextResponse.json({ ok: true, bank_transfer: account !== null, momo });
}
