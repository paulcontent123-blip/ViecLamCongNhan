import { NextRequest, NextResponse } from "next/server";
import { getMobileRightBySlug } from "@/lib/mobile-content";
import { parseMobileSlug } from "@/lib/mobile-content-params";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const card = await getMobileRightBySlug(parseMobileSlug((await params).slug));
    return card
      ? NextResponse.json({ card })
      : NextResponse.json({ error: "Không tìm thấy quyền lợi." }, { status: 404 });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("GET /api/mobile/rights/:slug failed:", error);
    return NextResponse.json({ error: "Không tải được quyền lợi." }, { status: 500 });
  }
}
