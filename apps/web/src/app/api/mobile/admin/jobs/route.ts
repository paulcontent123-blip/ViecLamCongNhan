import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminJobs, getJobStatusCounts, type AdminJobStatus } from "@/lib/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";

const headers = { "Cache-Control": "private, no-store" };
const statuses = ["pending", "approved", "closed", "expired"] as const;

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

    const { page, pageSize, offset, status } = parseEmployerListParams(request.nextUrl.searchParams, statuses);
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length > 100) throw new RangeError("Từ khóa tối đa 100 ký tự.");

    const [{ jobs, total }, counts] = await Promise.all([
      getAdminJobs({ status: status as AdminJobStatus | undefined, q: q || undefined, limit: pageSize, offset }),
      getJobStatusCounts(),
    ]);

    return NextResponse.json({ ok: true, items: jobs, total, page, pageSize, counts }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("GET /api/mobile/admin/jobs failed:", error);
    return NextResponse.json({ error: "Không tải được tin tuyển dụng." }, { status: 500, headers });
  }
}
