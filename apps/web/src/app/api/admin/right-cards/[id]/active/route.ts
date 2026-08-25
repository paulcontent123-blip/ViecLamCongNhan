import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { setRightCardActive } from "@/lib/admin";

const bodySchema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { id } = await params;
  const ok = await setRightCardActive(id, parsed.data.isActive);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy thẻ quyền lợi." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
