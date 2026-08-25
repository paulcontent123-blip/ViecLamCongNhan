// Cấu hình danh mục Tin tức — tách riêng khỏi lib/content.ts vì file đó import
// createSupabaseServerClient (dùng next/headers, chỉ chạy được ở Server Component).
// Module này KHÔNG có side-effect server-only nên an toàn import từ Client Component
// (VD: ArticleManagement.tsx cần ARTICLE_CATEGORIES cho <select> chọn danh mục).
// Khớp constraint articles_category_check ở migration 20260819100001_news_rights_qa.sql.
export const ARTICLE_CATEGORIES = {
  luong_thuong: { label: "Lương & Thưởng", icon: "📋", gradientClass: "from-brand-navy to-slate-700", textClass: "text-brand-orange" },
  bhxh_baohiem: { label: "BHXH & Bảo hiểm", icon: "🏥", gradientClass: "from-emerald-600 to-emerald-800", textClass: "text-emerald-600" },
  phap_ly_lao_dong: { label: "Pháp lý lao động", icon: "⚖", gradientClass: "from-red-600 to-red-800", textClass: "text-red-600" },
  phuc_loi: { label: "Phúc lợi", icon: "💰", gradientClass: "from-amber-600 to-amber-800", textClass: "text-amber-600" },
  tin_kcn: { label: "Tin KCN", icon: "🏭", gradientClass: "from-blue-600 to-blue-900", textClass: "text-blue-600" },
  an_toan_lao_dong: { label: "An toàn lao động", icon: "🛡", gradientClass: "from-violet-600 to-violet-800", textClass: "text-violet-600" },
} as const;

export type ArticleCategory = keyof typeof ARTICLE_CATEGORIES;

export function isArticleCategory(value: string): value is ArticleCategory {
  return value in ARTICLE_CATEGORIES;
}
