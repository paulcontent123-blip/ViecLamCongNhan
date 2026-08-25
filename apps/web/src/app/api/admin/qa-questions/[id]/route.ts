import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { answerQAQuestion, deleteQAQuestion, unpublishQAQuestion } from "@/lib/admin";

const answerSchema = z.object({
  answer: z.string().trim().min(5, "Câu trả lời tối thiểu 5 ký tự."),
  publish: z.boolean(),
});
const unpublishSchema = z.object({ unpublish: z.literal(true) });
const bodySchema = z.union([answerSchema, unpublishSchema]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { id } = await params;
  const ok =
    "unpublish" in parsed.data
      ? await unpublishQAQuestion(id)
      : await answerQAQuestion(id, parsed.data.answer, parsed.data.publish);

  if (!ok) return NextResponse.json({ error: "Không cập nhật được câu hỏi, thử lại sau." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const { id } = await params;
  const ok = await deleteQAQuestion(id);
  if (!ok) return NextResponse.json({ error: "Không xoá được câu hỏi." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
