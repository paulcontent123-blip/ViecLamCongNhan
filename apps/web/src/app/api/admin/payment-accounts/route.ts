import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { createPaymentAccount } from "@/lib/admin-payment";
import { paymentAccountSchema } from "@/lib/payment-schemas";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin("payments");
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsed = paymentAccountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const result = await createPaymentAccount(parsed.data);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
  await logAdminAction(session, "payment_account.create", { type: "payment_account", id: String(result.account?.id ?? "") });
  return NextResponse.json({ ok: true, account: result.account }, { status: 201 });
}
