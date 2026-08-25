import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEmployerSession } from "@/lib/employer-auth";
import { updateEmployerProfile, isEmployerVerified } from "@/lib/employer";

const bodySchema = z.object({
  companyName: z.string().min(2, "Vui lòng nhập tên công ty"),
  contactPhone: z.string().min(9, "Số điện thoại không hợp lệ"),
  fullName: z.string().min(2, "Vui lòng nhập tên người phụ trách"),
  taxCode: z.string().optional(),
  provinceCode: z.string().optional(),
  industry: z.string().optional(),
  companyLogoUrl: z.string().url().optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await getEmployerSession();
  if (!session) {
    return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  }

  if (!(await isEmployerVerified(session.employerId))) {
    return NextResponse.json(
      { error: "Tài khoản của bạn đang chờ Admin xác minh pháp nhân. Vui lòng chờ xác minh để sửa hồ sơ." },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const result = await updateEmployerProfile(session.employerId, session.userId, parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
