import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { deleteKcn, updateKcn } from "@/lib/admin";

const bodySchema = z.object({
  name: z.string().trim().min(3, "Tên KCN tối thiểu 3 ký tự."),
  provinceCode: z.string().min(1, "Vui lòng chọn tỉnh/thành."),
  address: z.string().trim().optional().or(z.literal("")),
  totalAreaHa: z.coerce.number().min(0).optional(),
  occupiedPct: z.coerce.number().min(0).max(100).optional(),
  activeCompanies: z.coerce.number().int().min(0).optional(),
  industries: z.array(z.string()).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { id } = await params;
  const result = await updateKcn(id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, kcn: result.kcn });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const { id } = await params;
  const ok = await deleteKcn(id);
  if (!ok) return NextResponse.json({ error: "Không xoá được KCN." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
