import Link from "next/link";
import { ARTICLE_CATEGORIES, type ArticleRow } from "@/lib/content";
import { ROUTES } from "@/lib/routes";

export function ArticleCard({ article }: { article: ArticleRow }) {
  const meta = ARTICLE_CATEGORIES[article.category];
  return (
    <Link
      href={`${ROUTES.tinTucQuyenLoi}/${article.slug}`}
      className="group overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm transition hover:border-brand-orange"
    >
      <div className={`flex h-[130px] items-center justify-center bg-gradient-to-br ${meta.gradientClass} text-[40px]`}>
        {meta.icon}
      </div>
      <div className="p-3.5">
        <div className={`mb-1.5 text-[10px] font-bold uppercase tracking-wide ${meta.textClass}`}>{meta.label}</div>
        <div className="mb-1.5 text-[14px] font-bold leading-snug text-brand-navy">{article.title}</div>
        <div className="text-[11.5px] text-brand-navy/45">
          📅 {article.published_at ? new Date(article.published_at).toLocaleDateString("vi-VN") : "—"} · ⏱{" "}
          {article.read_minutes} phút đọc
        </div>
      </div>
    </Link>
  );
}
