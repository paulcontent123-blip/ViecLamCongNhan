import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminQAQuestions, type AdminQAStatus } from "@/lib/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";

const headers = { "Cache-Control": "private, no-store" };
const statuses = ["new", "answered", "published"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

    const { page, pageSize, offset, status } = parseEmployerListParams(request.nextUrl.searchParams, statuses);
    const id = request.nextUrl.searchParams.get("id") ?? undefined;
    if (id && !UUID_PATTERN.test(id)) throw new RangeError("Mã câu hỏi không hợp lệ.");

    const result = await getAdminQAQuestions({
      limit: id ? 1 : pageSize,
      offset: id ? 0 : offset,
      status: id ? undefined : (status as AdminQAStatus | undefined),
      id,
    });
    return NextResponse.json({
      ok: true,
      items: result.questions,
      total: result.total,
      newCount: result.newCount,
      page: id ? 1 : page,
      pageSize: id ? 1 : pageSize,
    }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("GET /api/mobile/admin/qa-questions failed:", error);
    return NextResponse.json({ error: "Không tải được danh sách câu hỏi." }, { status: 500, headers });
  }
}
