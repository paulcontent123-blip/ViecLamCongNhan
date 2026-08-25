import Link from "next/link";
import { ARTICLE_CATEGORIES, getPublishedArticles, isArticleCategory, ARTICLES_PAGE_SIZE } from "@/lib/content";
import { ROUTES } from "@/lib/routes";
import { buildQuery } from "@/lib/url";
import { SectionTabs } from "@/components/tintuc/SectionTabs";
import { ArticleCard } from "@/components/tintuc/ArticleCard";
import { Pagination } from "@/components/timviec/Pagination";

function toSp(searchParams: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

export default async function TinTucQuyenLoiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = toSp(await searchParams);
  const category = sp.category && isArticleCategory(sp.category) ? sp.category : undefined;
  const currentPage = Math.max(1, sp.page ? Number(sp.page) || 1 : 1);

  const { articles, total } = await getPublishedArticles({
    category,
    limit: ARTICLES_PAGE_SIZE,
    offset: (currentPage - 1) * ARTICLES_PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / ARTICLES_PAGE_SIZE));

  return (
    <div className="px-4 pb-20 pt-10 sm:px-8 lg:px-[52px]">
      <div className="mx-auto max-w-6xl">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">
          Tin tức & Quyền lợi công nhân
        </div>
        <h1 className="mt-2 text-[26px] font-extrabold text-brand-navy sm:text-[30px]">
          Cập nhật tin tức — <em className="text-brand-orange not-italic">bảo vệ quyền lợi</em>
        </h1>
        <p className="mt-2 max-w-2xl text-[13.5px] text-brand-navy/50">
          Bài viết pháp lý, tin tức lao động và thông tin quyền lợi người lao động theo Bộ luật Lao động 2019.
          Cập nhật liên tục từ đội ngũ chuyên gia VEA.
        </p>

        <div className="mt-6">
          <SectionTabs active={ROUTES.tinTucQuyenLoi} />
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <Link
            href={`${ROUTES.tinTucQuyenLoi}${buildQuery(sp, { category: undefined, page: undefined })}`}
            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
              !category
                ? "border-brand-orange bg-brand-orange text-white"
                : "border-black/10 bg-white text-brand-navy/60 hover:border-brand-orange hover:text-brand-orange"
            }`}
          >
            Tất cả
          </Link>
          {Object.entries(ARTICLE_CATEGORIES).map(([key, meta]) => (
            <Link
              key={key}
              href={`${ROUTES.tinTucQuyenLoi}${buildQuery(sp, { category: key, page: undefined })}`}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                category === key
                  ? "border-brand-orange bg-brand-orange text-white"
                  : "border-black/10 bg-white text-brand-navy/60 hover:border-brand-orange hover:text-brand-orange"
              }`}
            >
              {meta.icon} {meta.label}
            </Link>
          ))}
        </div>

        {articles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
            Chưa có bài viết nào trong danh mục này.
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          sp={sp}
          basePath={ROUTES.tinTucQuyenLoi}
          extraParams={{}}
        />
      </div>
    </div>
  );
}
