import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { deleteMomoWallet, setMomoWalletActive, updateMomoWallet } from "@/lib/admin-payment";
import { momoWalletSchema } from "@/lib/payment-schemas";

// Sửa thông tin ví, hoặc bật/tắt ví đó ({ active: boolean }).
const bodySchema = z.union([z.object({ active: z.boolean() }), momoWalletSchema]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { id } = await params;
  const result =
    "active" in parsed.data
      ? await setMomoWalletActive(id, parsed.data.active)
      : await updateMomoWallet(id, parsed.data);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const { id } = await params;
  await deleteMomoWallet(id);
  return NextResponse.json({ ok: true });
}
