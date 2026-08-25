import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEmployerSession } from "@/lib/employer-auth";
import { updateEmployerApplicationStatus, isEmployerVerified } from "@/lib/employer";
import { isApplicationStatus } from "@/lib/application-status";

const bodySchema = z.object({
  status: z.string().refine(isApplicationStatus, "Trạng thái không hợp lệ"),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getEmployerSession();
  if (!session) {
    return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  }

  if (!(await isEmployerVerified(session.employerId))) {
    return NextResponse.json(
      { error: "Tài khoản của bạn đang chờ Admin xác minh pháp nhân. Vui lòng chờ xác minh để cập nhật ứng viên." },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { id } = await params;
  const ok = await updateEmployerApplicationStatus(session.employerId, id, parsed.data.status);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy hồ sơ ứng tuyển." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
