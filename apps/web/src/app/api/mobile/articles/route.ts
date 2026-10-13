import { NextRequest, NextResponse } from "next/server";
import { ARTICLE_CATEGORIES, type ArticleCategory } from "@/lib/article-categories";
import { getMobileArticles } from "@/lib/mobile-content";
import { parseMobileCategory, parseMobilePagination } from "@/lib/mobile-content-params";

export async function GET(request: NextRequest) {
  try {
    const { limit, offset } = parseMobilePagination(request.nextUrl.searchParams, 6);
    const category = parseMobileCategory(
      request.nextUrl.searchParams.get("category"), ARTICLE_CATEGORIES,
    ) as ArticleCategory | undefined;
    return NextResponse.json(await getMobileArticles({ category, limit, offset }));
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("GET /api/mobile/articles failed:", error);
    return NextResponse.json({ error: "Không tải được bài viết." }, { status: 500 });
  }
}
