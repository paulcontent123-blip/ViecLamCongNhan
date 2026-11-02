import { NextResponse } from "next/server";
import { getMobileServicePackages } from "@/lib/mobile-service-cards";

const headers = { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" };

export async function GET() {
  try {
    return NextResponse.json({ ok: true, cards: await getMobileServicePackages() }, { headers });
  } catch (error) {
    console.error("GET /api/mobile/service-packages failed:", error);
    return NextResponse.json({ error: "Không tải được dịch vụ trọn gói." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
