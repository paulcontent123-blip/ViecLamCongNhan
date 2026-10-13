import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeArticleHtml } from "@/lib/sanitize-html";
import type { ArticleCategory } from "@/lib/article-categories";
import type { ArticleRow, RightCardRow, PublishedFaqRow } from "@/lib/content";

export type MobileArticleSummary = Pick<
  ArticleRow,
  "id" | "slug" | "title" | "excerpt" | "cover_image_url" | "author_name" |
  "category" | "read_minutes" | "published_at"
>;
export type MobileRightSummary = Pick<
  RightCardRow,
  "id" | "slug" | "icon" | "title" | "summary" | "effective_note"
>;

const ARTICLE_SUMMARY_SELECT =
  "id, slug, title, excerpt, cover_image_url, author_name, category, read_minutes, published_at";
const ARTICLE_DETAIL_SELECT =
  "id, slug, title, excerpt, content, content_format, seo_description, cover_image_url, author_name, show_toc, category, read_minutes, published_at, view_count";
const RIGHT_SUMMARY_SELECT = "id, slug, icon, title, summary, effective_note";
const RIGHT_DETAIL_SELECT = "id, slug, icon, title, summary, content, effective_note";

function publicArticle(article: ArticleRow): ArticleRow {
  return article.content_format === "html"
    ? { ...article, content: sanitizeArticleHtml(article.content) }
    : article;
}

export async function getMobileArticles({ category, limit, offset }: {
  category?: ArticleCategory; limit: number; offset: number;
}): Promise<{ articles: MobileArticleSummary[]; total: number }> {
  const client = await createSupabaseServerClient();
  let query = client.from("articles")
    .select(ARTICLE_SUMMARY_SELECT, { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (category) query = query.eq("category", category);
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return { articles: (data ?? []) as MobileArticleSummary[], total: count ?? 0 };
}

export async function getMobileArticleBySlug(slug: string): Promise<ArticleRow | null> {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.from("articles")
    .select(ARTICLE_DETAIL_SELECT)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? publicArticle(data as ArticleRow) : null;
}

export async function getMobileRights({ limit, offset }: {
  limit: number; offset: number;
}): Promise<{ cards: MobileRightSummary[]; total: number }> {
  const client = await createSupabaseServerClient();
  const { data, error, count } = await client.from("right_cards")
    .select(RIGHT_SUMMARY_SELECT, { count: "exact" })
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { cards: (data ?? []) as MobileRightSummary[], total: count ?? 0 };
}

export async function getMobileRightBySlug(slug: string): Promise<RightCardRow | null> {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.from("right_cards")
    .select(RIGHT_DETAIL_SELECT)
    .eq("is_active", true)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as RightCardRow | null;
}

export async function getMobileFaqs({ limit, offset }: {
  limit: number; offset: number;
}): Promise<{ faqs: PublishedFaqRow[]; total: number }> {
  const client = await createSupabaseServerClient();
  // Never select contact or full_name; both belong to the private submitted question.
  const { data, error, count } = await client.from("qa_questions")
    .select("id, question, answer", { count: "exact" })
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { faqs: (data ?? []) as PublishedFaqRow[], total: count ?? 0 };
}
