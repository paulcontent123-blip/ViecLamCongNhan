import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { activatePaymentAccount, deletePaymentAccount, updatePaymentAccount } from "@/lib/admin-payment";
import { paymentAccountSchema } from "@/lib/payment-schemas";

// Sửa thông tin tài khoản, hoặc chỉ bật tài khoản đó ({ activate: true }).
const bodySchema = z.union([z.object({ activate: z.literal(true) }), paymentAccountSchema]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { id } = await params;
  const result =
    "activate" in parsed.data ? await activatePaymentAccount(id) : await updatePaymentAccount(id, parsed.data);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const { id } = await params;
  await deletePaymentAccount(id);
  return NextResponse.json({ ok: true });
}
