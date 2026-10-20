import { NextRequest, NextResponse } from "next/server";
import {
  getAdminOrderById,
  getAdminOrders,
  getAdminOrderStats,
  type AdminOrderStatus,
} from "@/lib/admin";
import { getAdminSession } from "@/lib/admin-auth";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";

const headers = { "Cache-Control": "private, no-store" };
const statuses = ["pending", "paid", "cancelled", "refunded"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

    const searchParams = request.nextUrl.searchParams;
    const { page, pageSize, offset, status } = parseEmployerListParams(searchParams, statuses);
    const id = searchParams.get("id") ?? undefined;
    if (id && !UUID_PATTERN.test(id)) throw new RangeError("Mã đơn hàng không hợp lệ.");
    const q = searchParams.get("q")?.trim() ?? "";
    if (q.length > 100) throw new RangeError("Từ khóa tối đa 100 ký tự.");

    const [result, stats] = await Promise.all([
      id
        ? getAdminOrderById(id).then((order) => ({ orders: order ? [order] : [], total: order ? 1 : 0 }))
        : getAdminOrders({
            status: status as AdminOrderStatus | undefined,
            q: q || undefined,
            limit: pageSize,
            offset,
          }),
      id ? Promise.resolve(null) : getAdminOrderStats(),
    ]);

    return NextResponse.json(
      {
        ok: true,
        items: result.orders,
        total: result.total,
        page: id ? 1 : page,
        pageSize: id ? 1 : pageSize,
        stats,
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("GET /api/mobile/admin/orders failed:", error);
    return NextResponse.json({ error: "Không tải được danh sách đơn hàng." }, { status: 500, headers });
  }
}
