import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  getAdminServiceInquiries,
  type AdminServiceInquiryStatus,
} from "@/lib/admin";
import {
  SERVICE_INQUIRY_TYPE_ADVERTISING,
  SERVICE_INQUIRY_TYPE_ADVERTISING_PRICING,
  SERVICE_INQUIRY_TYPE_SERVICE_PACKAGE,
  SERVICE_INQUIRY_TYPE_SERVICE_PARTNER,
} from "@/lib/service-inquiry";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";

const headers = { "Cache-Control": "private, no-store" };
const types = [
  SERVICE_INQUIRY_TYPE_SERVICE_PACKAGE,
  SERVICE_INQUIRY_TYPE_ADVERTISING,
  SERVICE_INQUIRY_TYPE_SERVICE_PARTNER,
  SERVICE_INQUIRY_TYPE_ADVERTISING_PRICING,
] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

    const searchParams = request.nextUrl.searchParams;
    const { page, pageSize, offset, status } = parseEmployerListParams(searchParams, ["new", "consulted", "cancelled"]);
    const rawType = searchParams.get("type");
    if (rawType !== null && !(types as readonly string[]).includes(rawType)) {
      throw new RangeError("Loại yêu cầu tư vấn không hợp lệ.");
    }
    const type = rawType ?? undefined;
    const id = searchParams.get("id") ?? undefined;
    if (id && !UUID_PATTERN.test(id)) throw new RangeError("Mã yêu cầu tư vấn không hợp lệ.");
    const q = searchParams.get("q")?.trim() ?? "";
    if (q.length > 100) throw new RangeError("Từ khóa tối đa 100 ký tự.");

    const result = await getAdminServiceInquiries({
      status: id ? undefined : status as AdminServiceInquiryStatus | undefined,
      type: id ? undefined : type,
      q: id ? undefined : q || undefined,
      id,
      limit: id ? 1 : pageSize,
      offset: id ? 0 : offset,
    });

    return NextResponse.json({
      ok: true,
      items: result.inquiries,
      total: result.total,
      newCount: result.newCount,
      page: id ? 1 : page,
      pageSize: id ? 1 : pageSize,
    }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("GET /api/mobile/admin/service-inquiries failed:", error);
    return NextResponse.json({ error: "Không tải được danh sách yêu cầu tư vấn." }, { status: 500, headers });
  }
}
