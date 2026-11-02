import { NextResponse } from "next/server";
import { getEmployerSession } from "@/lib/employer-auth";
import { getEmployerServiceInquiries } from "@/lib/employer";

const headers = { "Cache-Control": "private, no-store" };
const MAX_ITEMS = 100;

// Danh sách yêu cầu dịch vụ/quảng cáo đã gửi bằng số điện thoại của tài khoản nhà tuyển dụng
// (cùng nguồn với trang "Dịch vụ đã đặt" trên web). Chỉ đọc; không trả phone_normalized.
export async function GET() {
  try {
    const session = await getEmployerSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
    const rows = await getEmployerServiceInquiries(session.employerId);
    const items = rows.slice(0, MAX_ITEMS).map((row) => ({ ...row, phone_normalized: undefined }));
    return NextResponse.json({ ok: true, items, total: rows.length }, { headers });
  } catch (error) {
    console.error("GET /api/mobile/employer/service-inquiries failed:", error);
    return NextResponse.json({ error: "Không tải được dịch vụ đã đặt." }, { status: 500, headers });
  }
}
