import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEmployerSession } from "@/lib/employer-auth";
import { cancelEmployerServiceInquiry } from "@/lib/employer";

const bodySchema = z.object({
  reason: z.string().trim().min(3, "Vui lòng nhập lý do hủy tư vấn.").max(1000, "Lý do hủy tối đa 1.000 ký tự."),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getEmployerSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { id } = await params;
  const result = await cancelEmployerServiceInquiry(session.employerId, id, parsed.data.reason);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, inquiry: result.inquiry });
}
