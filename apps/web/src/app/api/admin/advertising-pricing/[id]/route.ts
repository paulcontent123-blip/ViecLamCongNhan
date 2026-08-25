import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { deleteAdvertisingPricingCard, updateAdvertisingPricingCard } from "@/lib/admin";

const bodySchema = z.object({
  format: z.string().trim().min(2, "Định dạng quảng cáo tối thiểu 2 ký tự."),
  placement: z.string().trim().min(1, "Vui lòng nhập vị trí hiển thị."),
  price: z.string().trim().min(1, "Vui lòng nhập giá quảng cáo."),
  unit: z.string().trim().min(1, "Vui lòng nhập đơn vị / thời hạn."),
  ctaLabel: z.string().trim().min(1, "Vui lòng nhập nội dung nút."),
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400 });

  const { id } = await params;
  const result = await updateAdvertisingPricingCard(id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, card: result.card });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const { id } = await params;
  const ok = await deleteAdvertisingPricingCard(id);
  if (!ok) return NextResponse.json({ error: "Không xoá được bảng giá." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
