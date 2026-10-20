import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { canMarkOrderPaid, isOrderStatus, rejectOrderPayment, updateOrderStatus } from "@/lib/admin";

// Đổi trạng thái đơn, hoặc trả đơn về cho NTD kèm lý do ({ rejectReason }).
const bodySchema = z.union([
  z.object({ status: z.string().refine(isOrderStatus, "Trạng thái không hợp lệ") }),
  z.object({ rejectReason: z.string().trim().min(5, "Vui lòng nhập lý do (tối thiểu 5 ký tự).").max(300) }),
]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { id } = await params;

  if ("rejectReason" in parsed.data) {
    const ok = await rejectOrderPayment(id, parsed.data.rejectReason);
    if (!ok) return NextResponse.json({ error: "Đơn này không còn ở trạng thái chờ." }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  // Chặn xác nhận khi NTD chưa bấm "Tôi đã thanh toán" ‑ xem canMarkOrderPaid.
  if (parsed.data.status === "paid" && !(await canMarkOrderPaid(id))) {
    return NextResponse.json(
      { error: "Nhà tuyển dụng chưa báo đã chuyển khoản cho đơn này." },
      { status: 409 },
    );
  }

  const ok = await updateOrderStatus(id, parsed.data.status);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
