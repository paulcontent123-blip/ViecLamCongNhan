import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { deleteRightCard, updateRightCard } from "@/lib/admin";

const bodySchema = z.object({
  icon: z.string().trim().min(1, "Vui lòng nhập icon."),
  title: z.string().trim().min(2, "Tiêu đề tối thiểu 2 ký tự."),
  summary: z.string().trim().min(5, "Nội dung tóm tắt tối thiểu 5 ký tự."),
  content: z.string().trim().optional().or(z.literal("")),
  effectiveNote: z.string().trim().optional().or(z.literal("")),
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
  const result = await updateRightCard(id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, card: result.card });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const { id } = await params;
  const ok = await deleteRightCard(id);
  if (!ok) return NextResponse.json({ error: "Không xoá được thẻ quyền lợi." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
