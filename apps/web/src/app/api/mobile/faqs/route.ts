import { NextRequest, NextResponse } from "next/server";
import { getMobileFaqs } from "@/lib/mobile-content";
import { parseMobilePagination } from "@/lib/mobile-content-params";

export async function GET(request: NextRequest) {
  try {
    const { limit, offset } = parseMobilePagination(request.nextUrl.searchParams, 20);
    return NextResponse.json(await getMobileFaqs({ limit, offset }));
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("GET /api/mobile/faqs failed:", error);
    return NextResponse.json({ error: "Không tải được câu hỏi thường gặp." }, { status: 500 });
  }
}
