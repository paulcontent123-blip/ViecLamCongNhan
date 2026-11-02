import { NextResponse } from "next/server";
import { getMobileAdvertising } from "@/lib/mobile-service-cards";

// Nội dung công khai (không cần đăng nhập); Admin sửa trên web, app thấy sau tối đa vài phút.
const headers = { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" };

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await getMobileAdvertising()) }, { headers });
  } catch (error) {
    console.error("GET /api/mobile/advertising failed:", error);
    return NextResponse.json({ error: "Không tải được nội dung quảng cáo." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
