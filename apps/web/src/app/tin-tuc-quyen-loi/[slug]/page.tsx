import Link from "next/link";
import { notFound } from "next/navigation";
import { ARTICLE_CATEGORIES, getArticleBySlug, getPublishedArticles } from "@/lib/content";
import { ROUTES } from "@/lib/routes";
import { ArticleCard } from "@/components/tintuc/ArticleCard";

export default async function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const meta = ARTICLE_CATEGORIES[article.category];
  const { articles: related } = await getPublishedArticles({ category: article.category, limit: 3 });
  const relatedArticles = related.filter((a) => a.id !== article.id).slice(0, 2);

  return (
    <div className="px-4 pb-20 pt-10 sm:px-8 lg:px-[52px]">
      <div className="mx-auto max-w-3xl">
        <Link href={ROUTES.tinTucQuyenLoi} className="text-[12.5px] font-bold text-brand-orange">
          ← Tin tức & Bài viết
        </Link>

        <div className={`mt-4 text-[11px] font-bold uppercase tracking-wide ${meta.textClass}`}>
          {meta.icon} {meta.label}
        </div>
        <h1 className="mt-2 text-[24px] font-extrabold leading-tight text-brand-navy sm:text-[28px]">
          {article.title}
        </h1>
        <div className="mt-3 text-[12.5px] text-brand-navy/45">
          📅 {article.published_at ? new Date(article.published_at).toLocaleDateString("vi-VN") : "—"} · ⏱{" "}
          {article.read_minutes} phút đọc
        </div>

        <div className={`mt-6 flex h-[180px] items-center justify-center rounded-2xl bg-gradient-to-br ${meta.gradientClass} text-[64px]`}>
          {meta.icon}
        </div>

        <div className="mt-6 whitespace-pre-line text-[14.5px] leading-[1.85] text-brand-navy/75">
          {article.content}
        </div>

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
