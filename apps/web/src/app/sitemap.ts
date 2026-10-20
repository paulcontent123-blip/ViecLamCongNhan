import type { MetadataRoute } from "next";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { absoluteUrl } from "@/lib/site-url";
import { ROUTES } from "@/lib/routes";

// Xây lại tối đa 1 lần/giờ. Tin tuyển dụng mới không cần xuất hiện trong sitemap
// tức thì, mà mỗi lần dựng là 4 query xuống Supabase ‑ không nên chạy mỗi request.
export const revalidate = 3600;

// Trần an toàn cho 1 query. Chuẩn sitemap cho phép tối đa 50.000 URL/file;
// khi nào vượt ngưỡng này thì phải tách thành nhiều file qua sitemap index.
const MAX_ROWS = 5000;

type Row = { slug: string; date: string | null };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createSupabasePublicClient();

  const [jobs, campaigns, articles, rights] = await Promise.all([
    supabase
      .from("jobs")
      .select("slug, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS),
    supabase
      .from("jobs")
      .select("slug, created_at")
      .eq("status", "approved")
      .eq("tier", "campaign")
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS),
    supabase
      .from("articles")
      .select("slug, updated_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(MAX_ROWS),
    supabase
      .from("right_cards")
      .select("slug, updated_at")
      .eq("is_active", true)
      .limit(MAX_ROWS),
  ]);

  // Một query lỗi thì chỉ mất nhóm URL đó, sitemap vẫn ra ‑ thà thiếu vài trang
  // còn hơn trả lỗi 500 khiến Google bỏ luôn cả sitemap.
  const rows = (res: { data: unknown; error: unknown }, dateKey: string): Row[] => {
    if (res.error || !Array.isArray(res.data)) return [];
    return (res.data as Record<string, string | null>[]).map((r) => ({
      slug: String(r.slug),
      date: r[dateKey] ?? null,
    }));
  };

  const now = new Date();
  const at = (d: string | null) => (d ? new Date(d) : now);

  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl(ROUTES.home), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl(ROUTES.timViecLam), lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl(ROUTES.tuyenDung), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl(ROUTES.dichVuTronGoi), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl(ROUTES.quangCaoHopTac), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl(ROUTES.tinTucQuyenLoi), lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: absoluteUrl(ROUTES.quyenLoi), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl(ROUTES.hoiDap), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl(ROUTES.ungVien), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];

  return [
    ...staticPages,
    ...rows(jobs, "created_at").map((r) => ({
      url: absoluteUrl(`${ROUTES.timViecLam}/${r.slug}`),
      lastModified: at(r.date),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...rows(campaigns, "created_at").map((r) => ({
      url: absoluteUrl(`${ROUTES.chienDich}/${r.slug}`),
      lastModified: at(r.date),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...rows(articles, "updated_at").map((r) => ({
      url: absoluteUrl(`${ROUTES.tinTucQuyenLoi}/${r.slug}`),
      lastModified: at(r.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...rows(rights, "updated_at").map((r) => ({
      url: absoluteUrl(`${ROUTES.quyenLoi}/${r.slug}`),
      lastModified: at(r.date),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
