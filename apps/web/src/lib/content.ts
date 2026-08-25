import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type ArticleCategory } from "@/lib/article-categories";

export { ARTICLE_CATEGORIES, isArticleCategory, type ArticleCategory } from "@/lib/article-categories";

export interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  category: ArticleCategory;
  read_minutes: number;
  published_at: string | null;
  view_count: number;
}

export const ARTICLES_PAGE_SIZE = 6;

export async function getPublishedArticles(
  filters: { category?: ArticleCategory; limit?: number; offset?: number } = {},
): Promise<{ articles: ArticleRow[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("articles")
    .select("id, slug, title, excerpt, content, category, read_minutes, published_at, view_count", {
      count: "exact",
    })
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (filters.category) query = query.eq("category", filters.category);

  const limit = filters.limit ?? ARTICLES_PAGE_SIZE;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error("getPublishedArticles error:", error.message);
    return { articles: [], total: 0 };
  }
  return { articles: (data ?? []) as ArticleRow[], total: count ?? 0 };
}

export async function getArticleBySlug(slug: string): Promise<ArticleRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("articles")
    .select("id, slug, title, excerpt, content, category, read_minutes, published_at, view_count")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as ArticleRow;
}

export interface RightCardRow {
  id: string;
  slug: string;
  icon: string;
  title: string;
  summary: string;
  content: string | null;
  effective_note: string | null;
}

export const RIGHT_CARDS_PAGE_SIZE = 9;

export async function getActiveRightCards(
  filters: { limit?: number; offset?: number } = {},
): Promise<{ cards: RightCardRow[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("right_cards")
    .select("id, slug, icon, title, summary, content, effective_note", { count: "exact" })
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const limit = filters.limit ?? RIGHT_CARDS_PAGE_SIZE;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error("getActiveRightCards error:", error.message);
    return { cards: [], total: 0 };
  }
  return { cards: (data ?? []) as RightCardRow[], total: count ?? 0 };
}

export async function getRightCardBySlug(slug: string): Promise<RightCardRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("right_cards")
    .select("id, slug, icon, title, summary, content, effective_note")
    .eq("is_active", true)
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as RightCardRow;
}

export interface PublishedFaqRow {
  id: string;
  question: string;
  answer: string | null;
}

export async function getPublishedFaqs(): Promise<PublishedFaqRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("qa_questions")
    .select("id, question, answer")
    .eq("status", "published")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("getPublishedFaqs error:", error.message);
    return [];
  }
  return (data ?? []) as PublishedFaqRow[];
}
