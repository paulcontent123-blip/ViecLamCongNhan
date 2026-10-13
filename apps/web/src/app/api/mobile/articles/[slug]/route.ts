import { NextRequest, NextResponse } from "next/server";
import { getMobileArticleBySlug } from "@/lib/mobile-content";
import { parseMobileSlug } from "@/lib/mobile-content-params";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const article = await getMobileArticleBySlug(parseMobileSlug((await params).slug));
    return article
      ? NextResponse.json({ article })
      : NextResponse.json({ error: "Không tìm thấy bài viết." }, { status: 404 });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("GET /api/mobile/articles/:slug failed:", error);
    return NextResponse.json({ error: "Không tải được bài viết." }, { status: 500 });
  }
}
