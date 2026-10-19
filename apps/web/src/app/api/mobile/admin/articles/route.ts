import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getMobileAdminArticles } from "@/lib/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";

const headers = { "Cache-Control": "private, no-store" };
const statuses = ["draft", "published"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

    const { page, pageSize, status } = parseEmployerListParams(request.nextUrl.searchParams, statuses);
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const id = request.nextUrl.searchParams.get("id") ?? undefined;
    if (q.length > 100) throw new RangeError("Từ khóa tối đa 100 ký tự.");
    if (id && !UUID_PATTERN.test(id)) throw new RangeError("Mã bài viết không hợp lệ.");

    const result = await getMobileAdminArticles({
      status: status as "draft" | "published" | undefined,
      q,
      page,
      pageSize,
      id,
    });
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("GET /api/mobile/admin/articles failed:", error);
    return NextResponse.json({ error: "Không tải được danh sách tin tức." }, { status: 500, headers });
  }
}
