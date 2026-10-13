import { NextRequest, NextResponse } from "next/server";
import { getMobileRights } from "@/lib/mobile-content";
import { parseMobilePagination } from "@/lib/mobile-content-params";

export async function GET(request: NextRequest) {
  try {
    const { limit, offset } = parseMobilePagination(request.nextUrl.searchParams, 9);
    return NextResponse.json(await getMobileRights({ limit, offset }));
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("GET /api/mobile/rights failed:", error);
    return NextResponse.json({ error: "Không tải được quyền lợi." }, { status: 500 });
  }
}
