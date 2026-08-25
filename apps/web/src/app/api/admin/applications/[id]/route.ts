import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { updateAdminApplicationStatus } from "@/lib/admin";
import { isApplicationStatus } from "@/lib/application-status";

const bodySchema = z.object({
  status: z.string().refine(isApplicationStatus, "Trạng thái không hợp lệ"),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { id } = await params;
  const ok = await updateAdminApplicationStatus(id, parsed.data.status);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy đơn ứng tuyển." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, applicationId: id, status: parsed.data.status });
}
