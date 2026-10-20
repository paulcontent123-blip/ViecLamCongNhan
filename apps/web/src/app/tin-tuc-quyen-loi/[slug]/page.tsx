import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ARTICLE_CATEGORIES, getArticleBySlug, getPublishedArticles } from "@/lib/content";
import { buildArticleToc } from "@/lib/article-html";
import { htmlToPlainText } from "@/lib/sanitize-html";
import { ROUTES } from "@/lib/routes";
import { ArticleCard } from "@/components/tintuc/ArticleCard";
import { ArticleToc } from "@/components/tintuc/ArticleToc";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "Không tìm thấy bài viết" };

  const description = (
    article.seo_description?.trim() ||
    article.excerpt?.trim() ||
    htmlToPlainText(article.content).slice(0, 160)
  ).slice(0, 300);

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      type: "article",
      publishedTime: article.published_at ?? undefined,
      images: article.cover_image_url ? [article.cover_image_url] : undefined,
    },
  };
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const meta = ARTICLE_CATEGORIES[article.category];
  const { articles: related } = await getPublishedArticles({ category: article.category, limit: 3 });
  const relatedArticles = related.filter((a) => a.id !== article.id).slice(0, 2);

  // Bài soạn bằng trình soạn thảo ở Admin đã được sanitize trước khi ghi DB nên render
  // thẳng bằng HTML; bài cũ dạng text thuần vẫn giữ cách hiển thị xuống dòng như trước.
  const isHtml = article.content_format === "html";
  const { html: contentHtml, headings } = isHtml
    ? buildArticleToc(article.content)
    : { html: "", headings: [] };
  const showToc = isHtml && article.show_toc && headings.length > 0;

  return (
    <div className="px-4 pb-20 pt-10 sm:px-8 lg:px-[52px]">
      <div className="mx-auto max-w-3xl">
        <Link href={ROUTES.tinTucQuyenLoi} className="text-[12.5px] font-bold text-brand-orange">
          ← Tin tức &amp; Bài viết
        </Link>

        <div className={`mt-4 text-[11px] font-bold uppercase tracking-wide ${meta.textClass}`}>
          {meta.icon} {meta.label}
        </div>
        <h1 className="mt-2 text-[24px] font-extrabold leading-tight text-brand-navy sm:text-[28px]">
          {article.title}
        </h1>
        <div className="mt-3 text-[12.5px] text-brand-navy/45">
          📅 {article.published_at ? new Date(article.published_at).toLocaleDateString("vi-VN") : "‑"} · ⏱{" "}
          {article.read_minutes} phút đọc
          {article.author_name ? ` · ✍ ${article.author_name}` : ""}
        </div>

        {article.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.cover_image_url}
            alt={article.title}
            className="mt-6 max-h-[420px] w-full rounded-2xl object-cover"
          />
        ) : (
          <div
            className={`mt-6 flex h-[180px] items-center justify-center rounded-2xl bg-gradient-to-br ${meta.gradientClass} text-[64px]`}
          >
            {meta.icon}
          </div>
        )}

        {article.excerpt && (
          <p className="mt-6 border-l-[3px] border-brand-orange/40 pl-4 text-[15px] font-medium leading-[1.75] text-brand-navy/70">
            {article.excerpt}
          </p>
        )}

        {showToc && (
          <div className="mt-6">
            <ArticleToc headings={headings} />
          </div>
        )}

        {isHtml ? (
          <div
            className="article-rich mt-6"
            // Nội dung đã đi qua sanitizeArticleHtml() ở lib/admin.ts trước khi lưu.
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        ) : (
          <div className="mt-6 whitespace-pre-line text-[14.5px] leading-[1.85] text-brand-navy/75">
            {article.content}
          </div>
        )}

        <div className="mt-8 rounded-xl border border-brand-orange/20 bg-brand-orange-light p-5">
          <div className="text-[13.5px] font-bold text-brand-navy">📞 Cần tư vấn thêm về quyền lợi lao động?</div>
          <p className="mt-1 text-[12.5px] text-brand-navy/55">
            Luật sư lao động VEA Law tư vấn miễn phí, bảo mật 100%.{" "}
            <Link href={ROUTES.hoiDap} className="font-bold text-brand-orange">
              Gửi câu hỏi →
            </Link>
          </p>
        </div>

        {relatedArticles.length > 0 && (
          <div className="mt-10">
            <div className="mb-3 text-[14px] font-extrabold text-brand-navy">Bài viết liên quan</div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              {relatedArticles.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
