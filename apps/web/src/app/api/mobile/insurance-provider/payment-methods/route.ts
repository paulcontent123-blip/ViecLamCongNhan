import { NextResponse } from "next/server";
import { getInsuranceProviderSession } from "@/lib/insurance-provider-auth";
import { getActivePaymentAccount, isMomoAvailable } from "@/lib/payment-orders";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const session = await getInsuranceProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const [account, momo] = await Promise.all([getActivePaymentAccount(), isMomoAvailable()]);
  return NextResponse.json({ ok: true, bank_transfer: account !== null, momo }, { headers });
}
