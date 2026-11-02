import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { createMomoWallet } from "@/lib/admin-payment";
import { momoWalletSchema } from "@/lib/payment-schemas";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin("payments");
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsed = momoWalletSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const result = await createMomoWallet(parsed.data);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
  await logAdminAction(session, "momo_wallet.create", { type: "momo_wallet", id: String(result.wallet?.id ?? "") });
  return NextResponse.json({ ok: true, wallet: result.wallet }, { status: 201 });
}
