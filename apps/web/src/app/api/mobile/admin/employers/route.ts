import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminEmployers } from "@/lib/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";

const headers = { "Cache-Control": "private, no-store" };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

    const { page, pageSize, offset } = parseEmployerListParams(request.nextUrl.searchParams, []);
    const searchParams = request.nextUrl.searchParams;
    const rawVerified = searchParams.get("verified");
    if (rawVerified !== null && rawVerified !== "true" && rawVerified !== "false") {
      throw new RangeError("verified phải là true hoặc false.");
    }
    const id = searchParams.get("id") ?? undefined;
    if (id && !UUID_PATTERN.test(id)) throw new RangeError("Mã nhà tuyển dụng không hợp lệ.");
    const q = searchParams.get("q")?.trim() ?? "";
    if (q.length > 100) throw new RangeError("Từ khóa tối đa 100 ký tự.");

    const { employers, total } = await getAdminEmployers({
      verified: rawVerified === null ? undefined : rawVerified === "true",
      id,
      q: q || undefined,
      limit: pageSize,
      offset,
    });
    const items = employers.map(({ users, ...employer }) => ({
      ...employer,
      email: users?.email ?? null,
      contact_name: users?.full_name ?? null,
    }));

    return NextResponse.json({ ok: true, items, total, page, pageSize }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("GET /api/mobile/admin/employers failed:", error);
    return NextResponse.json({ error: "Không tải được danh sách nhà tuyển dụng." }, { status: 500, headers });
  }
}
