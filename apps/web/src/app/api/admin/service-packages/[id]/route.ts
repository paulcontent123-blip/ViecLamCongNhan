import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { deleteServicePackageCard, updateServicePackageCard } from "@/lib/admin";

const bodySchema = z.object({
  icon: z.string().trim().min(1, "Vui lòng nhập icon."),
  title: z.string().trim().min(2, "Tên dịch vụ tối thiểu 2 ký tự."),
  description: z.string().trim().min(10, "Mô tả dịch vụ tối thiểu 10 ký tự."),
  features: z.array(z.string().trim().min(1)).min(1, "Vui lòng nhập ít nhất 1 tính năng."),
  price: z.string().trim().min(1, "Vui lòng nhập mức giá."),
  ctaLabel: z.string().trim().min(2, "Nội dung nút tối thiểu 2 ký tự."),
  accent: z.enum(["orange", "green", "amber", "red", "full"]),
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { id } = await params;
  const result = await updateServicePackageCard(id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, card: result.card });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const { id } = await params;
  const ok = await deleteServicePackageCard(id);
  if (!ok) return NextResponse.json({ error: "Không xoá được dịch vụ." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
