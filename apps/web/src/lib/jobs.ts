import { createSupabaseServerClient } from "@/lib/supabase/server";
import { industryLikePattern } from "@/lib/industries";
import type { JobWithRelations } from "@/types/db";

export interface JobFilters {
  province?: string;
  industry?: string;
  kcnId?: string;
  salaryMin?: number; // triệu/tháng ‑ lọc job có salary_max >= ngưỡng này
  urgent?: boolean;
  housing?: boolean;
  shuttle?: boolean;
  meals?: boolean;
  noExperience?: boolean;
  shift?: "day" | "night" | "rotating";
  q?: string;
  sort?: "newest" | "salary_desc";
  limit?: number;
  offset?: number;
}

export const JOBS_PAGE_SIZE = 8;

export async function getJobs(
  filters: JobFilters,
): Promise<{ jobs: JobWithRelations[]; total: number }> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("jobs")
    .select("*, employers(company_name, company_logo_url), kcn(name)", { count: "exact" })
    .eq("status", "approved");

  if (filters.province) query = query.eq("province_code", filters.province);
  // industry_key so khớp không phân biệt hoa/thường + không dấu, và chỉ cần chứa 1
  // phần ký tự gõ vào (ILIKE %...%) ‑ không cần gõ đủ nguyên cụm (xem migration
  // 20260820110001) ‑ cần thiết vì industry giờ có thể là text NTD tự gõ, không chỉ
  // slug chuẩn trong JOB_INDUSTRIES.
  if (filters.industry) query = query.ilike("industry_key", industryLikePattern(filters.industry));
  if (filters.kcnId) query = query.eq("kcn_id", filters.kcnId);
  if (filters.salaryMin) query = query.gte("salary_max", filters.salaryMin * 1_000_000);
  if (filters.urgent) query = query.eq("is_urgent", true);
  if (filters.housing) query = query.eq("has_housing", true);
  if (filters.shuttle) query = query.eq("has_shuttle", true);
  if (filters.meals) query = query.eq("has_meals", true);
  if (filters.noExperience) query = query.eq("no_experience_required", true);
  if (filters.shift) query = query.eq("shift_type", filters.shift);
  if (filters.q) query = query.ilike("title", `%${filters.q}%`);

  // tier_weight ưu tiên tin của tài khoản Premium/gói Chiến dịch lên đầu, kế tiếp
  // Basic, cuối cùng mới tới Free ‑ quyền lợi "hiển thị profile công ty ngoài trang
  // chủ/tìm kiếm" (xem account-tiers.ts).
  query = query.order("tier_weight", { ascending: false });
  if (filters.sort === "salary_desc") {
    query = query.order("salary_max", { ascending: false, nullsFirst: false });
  } else {
    // Trong cùng 1 hạng (VD 2 tin Basic), tin ĐĂNG TRƯỚC được đẩy lên trước ‑ không
    // phải mới nhất lên đầu. Đây là lựa chọn nghiệp vụ có chủ đích (công bằng theo
    // thứ tự đăng ký, tránh tin trả phí cũ bị tin trả phí mới liên tục đẩy xuống).
    query = query.order("created_at", { ascending: true });
  }

  const limit = filters.limit ?? JOBS_PAGE_SIZE;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error("getJobs error:", error.message);
    return { jobs: [], total: 0 };
  }

  return { jobs: (data ?? []) as unknown as JobWithRelations[], total: count ?? 0 };
}

export async function getJobBySlug(slug: string): Promise<JobWithRelations | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*, employers(company_name, company_logo_url), kcn(name)")
    .eq("status", "approved")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as JobWithRelations;
}

// Chỉ là trần an toàn cho 1 query ‑ khối "Chiến dịch tuyển dụng nổi bật" tự phân
// trang phía client (xem CampaignGrid.tsx, 9 chiến dịch/trang + 1 ô CTA cố định),
// không phải số lượng thẻ hiển thị 1 lần như trước.
export const FEATURED_CAMPAIGNS_LIMIT = 45;

/** Chiến dịch tuyển dụng (tier='campaign') đang còn hạn hiển thị ‑ dùng cho khối
 * "Chiến dịch tuyển dụng nổi bật" ở trang chủ. */
export async function getFeaturedCampaigns(limit = FEATURED_CAMPAIGNS_LIMIT): Promise<JobWithRelations[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*, employers(company_name, company_logo_url), kcn(name)")
    .eq("status", "approved")
    .eq("tier", "campaign")
    // expires_at null coi như chưa hết hạn (không dùng .gt vì NULL luôn bị loại khỏi
    // so sánh, kể cả khi đó là chiến dịch hợp lệ chưa có ngày hết hạn).
    .or(`expires_at.gt.${new Date().toISOString()},expires_at.is.null`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getFeaturedCampaigns error:", error.message);
    return [];
  }
  return (data ?? []) as unknown as JobWithRelations[];
}

/** Trang chi tiết Chiến dịch (/chien-dich/[slug]) ‑ chỉ trả về tin tier='campaign',
 * để không lộ trang chiến dịch cho tin thường qua đúng slug. */
export async function getCampaignBySlug(slug: string): Promise<JobWithRelations | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("*, employers(company_name, company_logo_url), kcn(name)")
    .eq("status", "approved")
    .eq("tier", "campaign")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as JobWithRelations;
}
