import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/application-status";
import { ACCOUNT_TIERS, isPaidAccountTier } from "@/lib/account-tiers";
import { activateCampaignFromOrder } from "@/lib/employer";
import { hashPassword } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { isArticleCategory, type ArticleCategory } from "@/lib/article-categories";
import { htmlToPlainText, sanitizeArticleHtml } from "@/lib/sanitize-html";
import { PROVINCES, provinceName } from "@/lib/provinces";
import { ORDER_TYPE_LABEL } from "@/lib/order-labels";
import {
  SERVICE_INQUIRY_TYPE_ADVERTISING,
  SERVICE_INQUIRY_TYPE_ADVERTISING_PRICING,
  SERVICE_INQUIRY_TYPE_SERVICE_PARTNER,
  SERVICE_INQUIRY_TYPE_SERVICE_PACKAGE,
} from "@/lib/service-inquiry";
import type {
  AdvertisingPricingCardRow,
  KcnAdCardRow,
  KcnRow,
  ServiceInquiryRow,
  ServicePackageCardRow,
  ServicePartnerCardRow,
} from "@/types/db";

// Toàn bộ hàm ở đây dùng service-role client (bypass RLS) — quyền truy cập chỉ
// được đảm bảo bởi việc route/page gọi vào đã tự verify admin session trước
// (xem lib/admin-auth.ts), giống quy ước đã dùng ở lib/employer.ts.

// ───────────────────────────── Jobs ─────────────────────────────

const JOB_STATUSES = ["pending", "approved", "closed", "expired"] as const;
export type AdminJobStatus = (typeof JOB_STATUSES)[number];

export function isJobStatus(value: string): value is AdminJobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

export interface AdminJobRow {
  id: string;
  title: string;
  slug: string;
  province_code: string;
  industry: string;
  tier: string;
  status: string;
  created_at: string;
  employers: { company_name: string } | null;
}

export interface AdminListFilters {
  q?: string;
  limit?: number;
  offset?: number;
}

export const ADMIN_PAGE_SIZE = 20;

export async function getAdminJobs(
  filters: AdminListFilters & { status?: AdminJobStatus } = {},
): Promise<{ jobs: AdminJobRow[]; total: number }> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("jobs")
    .select("id, title, slug, province_code, industry, tier, status, created_at, employers(company_name)", {
      count: "exact",
    })
    // Giữ thứ tự của trang Admin; id là khóa phụ để phân trang ổn định khi trùng thời gian.
    .order("status", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.q) query = query.ilike("title", `%${filters.q}%`);

  const limit = filters.limit ?? ADMIN_PAGE_SIZE;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { jobs: (data ?? []) as unknown as AdminJobRow[], total: count ?? 0 };
}

export async function getJobStatusCounts(): Promise<Record<AdminJobStatus, number>> {
  const supabase = createSupabaseAdminClient();
  const results = await Promise.all(
    JOB_STATUSES.map((status) =>
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", status),
    ),
  );
  const counts = {} as Record<AdminJobStatus, number>;
  JOB_STATUSES.forEach((status, i) => {
    counts[status] = results[i].count ?? 0;
  });
  return counts;
}

export async function updateJobStatus(jobId: string, status: AdminJobStatus): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("jobs").update({ status }).eq("id", jobId).select("id").maybeSingle();
  return !error && !!data;
}

// ─────────────────────────── Candidates ───────────────────────────

const CANDIDATE_STATUSES = ["new", "viewed", "contacted", "rejected", "hired", "inactive"] as const;
export type AdminCandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export function isCandidateStatus(value: string): value is AdminCandidateStatus {
  return (CANDIDATE_STATUSES as readonly string[]).includes(value);
}

export interface AdminCandidateRow {
  id: string;
  full_name: string;
  phone: string;
  zalo: string | null;
  province: string | null;
  desired_industry: string | null;
  desired_salary_min: number | null;
  experience_years: number | null;
  status: string;
  created_at: string;
}

export async function getAdminCandidates(
  filters: AdminListFilters & { province?: string } = {},
): Promise<{ candidates: AdminCandidateRow[]; total: number }> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("candidates")
    .select(
      "id, full_name, phone, zalo, province, desired_industry, desired_salary_min, experience_years, status, created_at",
      { count: "exact" },
    )
    // Chỉ ứng viên tự điền form "Để lại thông tin" (quick_form) — ứng viên chỉ nộp
    // đơn vào 1 tin cụ thể (job_apply) xem ở mục Đơn ứng tuyển, không lộ vào Database.
    .eq("source", "quick_form")
    .order("created_at", { ascending: false });

  if (filters.province) query = query.eq("province", filters.province);
  if (filters.q) query = query.ilike("full_name", `%${filters.q}%`);

  const limit = filters.limit ?? ADMIN_PAGE_SIZE;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { candidates: (data ?? []) as AdminCandidateRow[], total: count ?? 0 };
}

export async function updateCandidateStatus(candidateId: string, status: AdminCandidateStatus): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("candidates")
    .update({ status })
    .eq("id", candidateId)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

// ───────────────────────── Applications ─────────────────────────

export interface AdminApplicationRow {
  id: string;
  status: string;
  cover_note: string | null;
  created_at: string;
  updated_at: string;
  jobs: {
    id: string;
    title: string;
    slug: string;
    employers: { company_name: string } | null;
  } | null;
  candidates: {
    id: string;
    full_name: string;
    phone: string;
    zalo: string | null;
    status: string;
  } | null;
}

/**
 * Danh sách đơn ứng tuyển dành cho Admin. Trạng thái ở đây là trạng thái của
 * đơn vào từng tin, không phải trạng thái tổng quát của bản ghi candidates.
 */
export async function getAdminApplications(
  filters: AdminListFilters & { status?: ApplicationStatus } = {},
): Promise<{ applications: AdminApplicationRow[]; total: number }> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("applications")
    .select(
      "id, status, cover_note, created_at, updated_at, jobs(id, title, slug, employers(company_name)), candidates(id, full_name, phone, zalo, status)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);

  // PostgREST không hỗ trợ một .ilike duy nhất cho hai bảng quan hệ. Tìm ID
  // trước rồi OR theo candidate_id/job_id để ô tìm kiếm vẫn hoạt động ổn định.
  const search = filters.q?.trim();
  if (search) {
    const pattern = `%${search}%`;
    const [{ data: matchingCandidates, error: candidateSearchError }, { data: matchingJobs, error: jobSearchError }] =
      await Promise.all([
        supabase.from("candidates").select("id").ilike("full_name", pattern),
        supabase.from("jobs").select("id").ilike("title", pattern),
      ]);

    if (candidateSearchError) throw new Error(candidateSearchError.message);
    if (jobSearchError) throw new Error(jobSearchError.message);

    const clauses: string[] = [];
    if (matchingCandidates?.length) {
      clauses.push(`candidate_id.in.(${matchingCandidates.map((candidate) => candidate.id).join(",")})`);
    }
    if (matchingJobs?.length) {
      clauses.push(`job_id.in.(${matchingJobs.map((job) => job.id).join(",")})`);
    }
    if (!clauses.length) return { applications: [], total: 0 };
    query = query.or(clauses.join(","));
  }

  const limit = filters.limit ?? ADMIN_PAGE_SIZE;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { applications: (data ?? []) as unknown as AdminApplicationRow[], total: count ?? 0 };
}

export async function getApplicationStatusCounts(): Promise<Record<ApplicationStatus, number>> {
  const supabase = createSupabaseAdminClient();
  const results = await Promise.all(
    APPLICATION_STATUSES.map((status) =>
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", status),
    ),
  );
  const counts = {} as Record<ApplicationStatus, number>;
  APPLICATION_STATUSES.forEach((status, index) => {
    if (results[index].error) throw new Error(results[index].error.message);
    counts[status] = results[index].count ?? 0;
  });
  return counts;
}

export async function updateAdminApplicationStatus(applicationId: string, status: ApplicationStatus): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", applicationId)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

// ─────────────────────────── Employers ───────────────────────────

export interface AdminEmployerRow {
  id: string;
  company_name: string;
  company_slug: string;
  industry: string | null;
  province_code: string;
  tax_code: string | null;
  contact_phone: string;
  is_verified: boolean;
  account_type: string;
  created_at: string;
  users: { email: string | null; full_name: string } | null;
}

export async function getAdminEmployers(
  filters: AdminListFilters & { verified?: boolean } = {},
): Promise<{ employers: AdminEmployerRow[]; total: number }> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("employers")
    .select(
      "id, company_name, company_slug, industry, province_code, tax_code, contact_phone, is_verified, account_type, created_at, users(email, full_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (filters.verified !== undefined) query = query.eq("is_verified", filters.verified);
  if (filters.q) query = query.ilike("company_name", `%${filters.q}%`);

  const limit = filters.limit ?? ADMIN_PAGE_SIZE;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { employers: (data ?? []) as unknown as AdminEmployerRow[], total: count ?? 0 };
}

export async function setEmployerVerified(employerId: string, verified: boolean): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("employers")
    .update({ is_verified: verified })
    .eq("id", employerId)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

// ───────────────────────────── Orders ─────────────────────────────

const ORDER_STATUSES = ["pending", "paid", "cancelled", "refunded"] as const;
export type AdminOrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: string): value is AdminOrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export { ORDER_TYPE_LABEL };

export interface AdminOrderRow {
  id: string;
  employer_id: string | null;
  order_type: string | null;
  tier: string | null;
  amount: number;
  payment_method: string | null;
  payment_ref: string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
  job_id: string | null;
  campaign_message: string | null;
  employers: { company_name: string; contact_phone: string | null } | null;
  jobs: { title: string } | null;
}

const ADMIN_ORDER_SELECT =
  "id, employer_id, order_type, tier, amount, payment_method, payment_ref, status, created_at, paid_at, job_id, campaign_message, employers(company_name, contact_phone), jobs(title)";

export async function getAdminOrders(
  filters: AdminListFilters & { status?: AdminOrderStatus } = {},
): Promise<{ orders: AdminOrderRow[]; total: number }> {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("orders").select(ADMIN_ORDER_SELECT, { count: "exact" }).order("created_at", {
    ascending: false,
  });

  if (filters.status) query = query.eq("status", filters.status);

  if (filters.q) {
    const q = filters.q.trim();
    const orConditions = [`order_type.ilike.%${q}%`, `tier.ilike.%${q}%`];

    // Cho gõ đúng nhãn tiếng Việt (VD "Chiến dịch") thay vì phải nhớ slug tiếng Anh lưu trong DB.
    const matchedTypes = Object.entries(ORDER_TYPE_LABEL)
      .filter(([, label]) => label.toLowerCase().includes(q.toLowerCase()))
      .map(([type]) => type);
    if (matchedTypes.length > 0) orConditions.push(`order_type.in.(${matchedTypes.join(",")})`);

    const { data: matchedEmployers } = await supabase.from("employers").select("id").ilike("company_name", `%${q}%`);
    if (matchedEmployers && matchedEmployers.length > 0) {
      orConditions.push(`employer_id.in.(${matchedEmployers.map((e) => e.id).join(",")})`);
    }

    // Mã đơn hiển thị dạng "DH1DECBE4D" (8 ký tự đầu của id, viết hoa). id là cột uuid
    // nên Postgres không ILIKE trực tiếp được (và PostgREST cũng không cho ép kiểu
    // ::text bên trong or=(...)) — lấy toàn bộ id (chỉ 1 cột, nhẹ) rồi so khớp tiền tố
    // ở phía JS, gom lại thành danh sách cho .in() (uuid so sánh chính xác không cần ILIKE).
    const idQuery = /^dh/i.test(q) ? q.slice(2) : q;
    if (idQuery.length >= 3) {
      const { data: allIds } = await supabase.from("orders").select("id");
      const matchedIds = (allIds ?? [])
        .filter((o) => o.id.toLowerCase().startsWith(idQuery.toLowerCase()))
        .map((o) => o.id);
      if (matchedIds.length > 0) orConditions.push(`id.in.(${matchedIds.join(",")})`);
    }

    query = query.or(orConditions.join(","));
  }

  const limit = filters.limit ?? ADMIN_PAGE_SIZE;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { orders: (data ?? []) as unknown as AdminOrderRow[], total: count ?? 0 };
}

export interface AdminOrderStats {
  revenueThisMonthVnd: number;
  revenueLastMonthVnd: number;
  ordersThisMonthCount: number;
  ordersLast7DaysCount: number;
  pendingCount: number;
  refundedThisMonthCount: number;
}

export async function getAdminOrderStats(): Promise<AdminOrderStats> {
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [thisMonthRes, lastMonthRes, last7DaysRes, pendingRes, refundedThisMonthRes] = await Promise.all([
    supabase.from("orders").select("amount, status").gte("created_at", startOfThisMonth.toISOString()),
    supabase
      .from("orders")
      .select("amount, status")
      .gte("created_at", startOfLastMonth.toISOString())
      .lt("created_at", startOfThisMonth.toISOString()),
    supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo.toISOString()),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    // Không có cột riêng ghi "ngày hoàn tiền" nên tạm lấy theo created_at trong tháng —
    // sát nghĩa "đơn hoàn tiền phát sinh tháng này" với dữ liệu hiện có.
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "refunded")
      .gte("created_at", startOfThisMonth.toISOString()),
  ]);

  const sumPaid = (rows: { amount: number; status: string }[] | null) =>
    (rows ?? []).filter((o) => o.status === "paid").reduce((sum, o) => sum + (o.amount ?? 0), 0);

  return {
    revenueThisMonthVnd: sumPaid(thisMonthRes.data),
    revenueLastMonthVnd: sumPaid(lastMonthRes.data),
    ordersThisMonthCount: thisMonthRes.data?.length ?? 0,
    ordersLast7DaysCount: last7DaysRes.count ?? 0,
    pendingCount: pendingRes.count ?? 0,
    refundedThisMonthCount: refundedThisMonthRes.count ?? 0,
  };
}

export async function updateOrderStatus(orderId: string, status: AdminOrderStatus): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  // Chỉ set paid_at khi CHUYỂN SANG "paid" — các trạng thái khác (huỷ, hoàn tiền...)
  // không đụng tới paid_at để giữ lại mốc thời gian đã thanh toán trước đó (VD đơn
  // paid -> refunded vẫn cần biết đã thanh toán lúc nào).
  const { data, error } = await supabase
    .from("orders")
    .update(status === "paid" ? { status, paid_at: new Date().toISOString() } : { status })
    .eq("id", orderId)
    .select("id, employer_id, order_type, tier, job_id, campaign_message")
    .maybeSingle();
  if (error || !data) return false;

  // Xác nhận thanh toán đơn thuê bao tài khoản (Basic/Premium) => kích hoạt ngay: nâng
  // account_type + đặt hạn theo chu kỳ thanh toán. Hết hạn chưa gia hạn sẽ tự động hạ
  // về Free khi đọc (xem employer.ts getEmployerAccountTier).
  if (status === "paid" && data.order_type === "account_subscription" && data.tier && isPaidAccountTier(data.tier)) {
    const perks = ACCOUNT_TIERS[data.tier];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (perks.billingCycleDays ?? 30));
    await supabase
      .from("employers")
      .update({ account_type: data.tier, account_tier_expires_at: expiresAt.toISOString() })
      .eq("id", data.employer_id);
  }

  // Hoàn tiền đơn thuê bao tài khoản (Basic/Premium) => phải thu hồi quyền lợi đã cấp,
  // không để NTD tiếp tục dùng gói đã hoàn tiền. Chỉ đụng account_type nếu gói đang
  // active hiện tại ĐÚNG LÀ gói do đơn này cấp — tránh trường hợp hoàn tiền 1 đơn cũ đã
  // bị 1 đơn mua gói mới hơn ghi đè từ trước, lại vô tình hạ nhầm gói NTD đang dùng.
  if (status === "refunded" && data.order_type === "account_subscription" && data.tier && isPaidAccountTier(data.tier)) {
    const { data: employer } = await supabase
      .from("employers")
      .select("account_type")
      .eq("id", data.employer_id)
      .maybeSingle();

    if (employer?.account_type === data.tier) {
      // Tìm đơn thuê bao đã thanh toán gần nhất (khác đơn đang hoàn tiền) để khôi phục
      // — nếu chu kỳ 30 ngày của đơn đó tính từ lúc thanh toán vẫn còn hiệu lực tới hiện
      // tại thì phục hồi đúng gói + hạn đó (VD premium -> basic), ngược lại hạ về Free
      // (VD premium -> free nếu chưa từng mua/gói cũ đã hết hạn).
      const { data: previousOrders } = await supabase
        .from("orders")
        .select("tier, paid_at")
        .eq("employer_id", data.employer_id)
        .eq("order_type", "account_subscription")
        .eq("status", "paid")
        .neq("id", orderId)
        .not("paid_at", "is", null)
        .order("paid_at", { ascending: false })
        .limit(1);

      const previous = previousOrders?.[0];
      let restored: { account_type: string; account_tier_expires_at: string | null } = {
        account_type: "free",
        account_tier_expires_at: null,
      };

      if (previous?.tier && isPaidAccountTier(previous.tier) && previous.paid_at) {
        const prevPerks = ACCOUNT_TIERS[previous.tier];
        const prevExpiresAt = new Date(previous.paid_at);
        prevExpiresAt.setDate(prevExpiresAt.getDate() + (prevPerks.billingCycleDays ?? 30));
        if (prevExpiresAt > new Date()) {
          restored = { account_type: previous.tier, account_tier_expires_at: prevExpiresAt.toISOString() };
        }
      }

      await supabase.from("employers").update(restored).eq("id", data.employer_id);
    }
  }

  // Xác nhận thanh toán đơn mua gói Chiến dịch => mới nâng tier tin lên 'campaign' +
  // chạy auto-blast Zalo cho ứng viên khớp ngành nghề/tỉnh thành (xem
  // activateCampaignFromOrder) — cố ý KHÔNG làm việc này ngay lúc NTD tạo đơn/tự khai
  // đã thanh toán, để tránh kích hoạt quyền lợi trả phí khi chưa xác minh đã nhận tiền.
  if (status === "paid" && data.order_type === "job_post" && data.tier === "campaign" && data.job_id) {
    await activateCampaignFromOrder(data.employer_id, data.job_id, data.campaign_message);
  }

  return true;
}

// ──────────────────────────── SMS Blasts ────────────────────────────

export interface AdminBlastRow {
  id: string;
  campaign_name: string | null;
  message: string;
  channel: string;
  recipient_count: number | null;
  sent_count: number;
  cost_vnd: number | null;
  status: string;
  sent_at: string | null;
  created_at: string;
  employers: { company_name: string } | null;
  jobs: { title: string } | null;
}

export async function getAdminBlasts(): Promise<AdminBlastRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sms_blasts")
    .select(
      "id, campaign_name, message, channel, recipient_count, sent_count, cost_vnd, status, sent_at, created_at, employers(company_name), jobs(title)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdminBlastRow[];
}

// ─────────────────────── Revenue Partners (Quảng cáo) ───────────────────────

export interface AdminPartnerRow {
  id: string;
  partner_name: string;
  partner_type: string | null;
  logo_url: string | null;
  affiliate_url: string | null;
  commission_pct: number | null;
  click_count: number;
  lead_count: number;
  revenue_vnd: number;
  is_active: boolean;
}

export async function getAdminPartners(): Promise<AdminPartnerRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("revenue_partners")
    .select("id, partner_name, partner_type, logo_url, affiliate_url, commission_pct, click_count, lead_count, revenue_vnd, is_active")
    .order("revenue_vnd", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminPartnerRow[];
}

export async function setPartnerActive(partnerId: string, active: boolean): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("revenue_partners")
    .update({ is_active: active })
    .eq("id", partnerId)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

// ───────────────────────────── Users ─────────────────────────────

export interface AdminUserRow {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  role: string;
  status: "active" | "deleted";
  created_at: string;
}

export const ADMIN_USER_ROLES = ["candidate", "employer", "agency", "admin"] as const;
export type AdminUserRole = (typeof ADMIN_USER_ROLES)[number];

export function isAdminUserRole(value: string): value is AdminUserRole {
  return (ADMIN_USER_ROLES as readonly string[]).includes(value);
}

export interface AdminUserInput {
  fullName: string;
  email?: string;
  phone?: string;
  role: AdminUserRole;
  password?: string;
}

type AdminUserMutationFailure = {
  ok: false;
  error: string;
  status: 400 | 404 | 409 | 500;
};

export type AdminUserMutationResult =
  | { ok: true; user: AdminUserRow }
  | AdminUserMutationFailure;

const ADMIN_USER_SELECT = "id, email, phone, full_name, role, status, created_at";

function normalizeUserInput(input: AdminUserInput) {
  return {
    full_name: input.fullName.trim(),
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    role: input.role,
  };
}

function validateAdminUserInput(input: AdminUserInput): AdminUserMutationFailure | null {
  const normalized = normalizeUserInput(input);
  if (normalized.full_name.length < 2) {
    return { ok: false, error: "Họ tên phải có ít nhất 2 ký tự.", status: 400 };
  }
  if (normalized.role === "admin" && !normalized.email) {
    return { ok: false, error: "Tài khoản Admin bắt buộc phải có email.", status: 400 };
  }
  if (normalized.role === "employer" && !normalized.email && !normalized.phone) {
    return { ok: false, error: "Tài khoản nhà tuyển dụng cần email hoặc số điện thoại.", status: 400 };
  }
  if (!normalized.email && !normalized.phone) {
    return { ok: false, error: "Vui lòng nhập email hoặc số điện thoại.", status: 400 };
  }
  if (input.password?.trim() && input.password.trim().length < 8) {
    return { ok: false, error: "Mật khẩu tối thiểu 8 ký tự.", status: 400 };
  }
  if ((normalized.role === "admin" || normalized.role === "employer") && !input.password?.trim()) {
    return {
      ok: false,
      error: normalized.role === "admin" ? "Tài khoản Admin bắt buộc phải có mật khẩu." : "Tài khoản nhà tuyển dụng cần có mật khẩu.",
      status: 400,
    };
  }
  return null;
}

export async function getAdminUsers(filters: { role?: string } = {}): Promise<AdminUserRow[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("users")
    .select(ADMIN_USER_SELECT)
    .order("created_at", { ascending: false });
  if (filters.role) query = query.eq("role", filters.role);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminUserRow[];
}

export async function createAdminUser(input: AdminUserInput): Promise<AdminUserMutationResult> {
  const validationError = validateAdminUserInput(input);
  if (validationError) return validationError;

  const supabase = createSupabaseAdminClient();
  const normalized = normalizeUserInput(input);
  const passwordHash = input.password?.trim() ? await hashPassword(input.password.trim()) : null;
  const { data, error } = await supabase
    .from("users")
    .insert({ ...normalized, password_hash: passwordHash, status: "active" })
    .select(ADMIN_USER_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Email hoặc số điện thoại đã được sử dụng.", status: 409 };
    }
    return { ok: false, error: "Không tạo được người dùng, vui lòng thử lại.", status: 500 };
  }
  return { ok: true, user: data as AdminUserRow };
}

export async function updateAdminUser(userId: string, input: AdminUserInput): Promise<AdminUserMutationResult> {
  const supabase = createSupabaseAdminClient();
  const validationError = validateAdminUserInput(input);

  // Khi sửa, mật khẩu để trống nghĩa là giữ nguyên mật khẩu cũ. Vì vậy chỉ
  // bỏ qua lỗi "bắt buộc mật khẩu" ở đây nếu tài khoản đã có hash.
  const { data: current, error: currentError } = await supabase
    .from("users")
    .select("id, email, phone, role, password_hash, status")
    .eq("id", userId)
    .maybeSingle();
  if (currentError) return { ok: false, error: "Không đọc được người dùng.", status: 500 };
  if (!current) return { ok: false, error: "Không tìm thấy người dùng.", status: 404 };

  if (validationError) {
    const passwordRequired = validationError.error.includes("bắt buộc phải có mật khẩu") || validationError.error.includes("cần có mật khẩu");
    if (!passwordRequired || (!current.password_hash && current.status !== "deleted")) return validationError;
  }

  const normalized = normalizeUserInput(input);
  if (current.status === "deleted") {
    const currentEmail = typeof current.email === "string" ? current.email.trim().toLowerCase() || null : null;
    const currentPhone = typeof current.phone === "string" ? current.phone.trim() || null : null;
    if (normalized.email !== currentEmail || normalized.phone !== currentPhone) {
      return {
        ok: false,
        error: "Không thể đổi email hoặc số điện thoại của tài khoản đã xóa vì thông tin này đang được giữ để chặn đăng ký lại.",
        status: 409,
      };
    }
  }

  if (current.role === "admin" && input.role !== "admin") {
    const { count, error: countError } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("status", "active");
    if (countError) return { ok: false, error: "Không kiểm tra được số lượng Admin.", status: 500 };
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "Không thể hạ quyền Admin cuối cùng.", status: 409 };
    }
  }

  const { data: linkedEmployer, error: employerError } = await supabase
    .from("employers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (employerError) return { ok: false, error: "Không kiểm tra được liên kết nhà tuyển dụng.", status: 500 };
  if (linkedEmployer && input.role !== "employer") {
    return {
      ok: false,
      error: "Tài khoản đang liên kết nhà tuyển dụng. Hãy giữ vai trò Nhà tuyển dụng hoặc xử lý hồ sơ công ty trước.",
      status: 409,
    };
  }

  const updatePayload: Record<string, string | boolean | null> = { ...normalized };
  if (input.password?.trim()) updatePayload.password_hash = await hashPassword(input.password.trim());

  const { data, error } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("id", userId)
    .select(ADMIN_USER_SELECT)
    .maybeSingle();
  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Email hoặc số điện thoại đã được sử dụng.", status: 409 };
    }
    return { ok: false, error: "Không cập nhật được người dùng, vui lòng thử lại.", status: 500 };
  }
  return { ok: true, user: data as AdminUserRow };
}

export async function softDeleteAdminUser(userId: string): Promise<AdminUserMutationFailure | { ok: true }> {
  const supabase = createSupabaseAdminClient();
  const { data: current, error: currentError } = await supabase
    .from("users")
    .select("id, role, status")
    .eq("id", userId)
    .maybeSingle();
  if (currentError) return { ok: false, error: "Không đọc được người dùng.", status: 500 };
  if (!current) return { ok: false, error: "Không tìm thấy người dùng.", status: 404 };

  if (current.status === "deleted") {
    return { ok: false, error: "Tài khoản này đã ở trạng thái Đã xóa.", status: 409 };
  }

  if (current.role === "admin") {
    const { count, error: countError } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("status", "active");
    if (countError) return { ok: false, error: "Không kiểm tra được số lượng Admin.", status: 500 };
    if ((count ?? 0) <= 1) {
      return { ok: false, error: "Không thể xóa Admin cuối cùng.", status: 409 };
    }
  }

  const { data, error } = await supabase
    .from("users")
    .update({ status: "deleted", password_hash: null })
    .eq("id", userId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Không cập nhật được trạng thái xóa, vui lòng thử lại.", status: 500 };
  return { ok: true };
}

// ─────────────────────────── Sidebar ───────────────────────────

export interface AdminSidebarCounts {
  pendingJobs: number;
  totalCandidates: number;
  totalApplications: number;
  unverifiedEmployers: number;
  newQuestions: number;
  newServiceInquiries: number;
  newKcnAdInquiries: number;
  newServicePartnerInquiries: number;
  newAdPricingInquiries: number;
}

/** Đếm nhẹ cho badge sidebar — gọi ở layout nên tách riêng khỏi getAdminDashboardStats (nặng hơn). */
export async function getAdminSidebarCounts(): Promise<AdminSidebarCounts> {
  const supabase = createSupabaseAdminClient();
  const [pendingJobs, totalCandidates, totalApplications, unverifiedEmployers, newQuestions, newServiceInquiries, newKcnAdInquiries, newServicePartnerInquiries, newAdPricingInquiries] = await Promise.all([
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "pending"),
    // Khớp với getAdminCandidates: badge "Database ứng viên" chỉ đếm quick_form.
    supabase.from("candidates").select("id", { count: "exact", head: true }).eq("source", "quick_form"),
    supabase.from("applications").select("id", { count: "exact", head: true }),
    supabase.from("employers").select("id", { count: "exact", head: true }).eq("is_verified", false),
    supabase.from("qa_questions").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase
      .from("service_inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .eq("type", SERVICE_INQUIRY_TYPE_SERVICE_PACKAGE),
    supabase
      .from("service_inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .eq("type", SERVICE_INQUIRY_TYPE_ADVERTISING),
    supabase
      .from("service_inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .eq("type", SERVICE_INQUIRY_TYPE_SERVICE_PARTNER),
    supabase
      .from("service_inquiries")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .eq("type", SERVICE_INQUIRY_TYPE_ADVERTISING_PRICING),
  ]);

  return {
    pendingJobs: pendingJobs.count ?? 0,
    totalCandidates: totalCandidates.count ?? 0,
    totalApplications: totalApplications.count ?? 0,
    newQuestions: newQuestions.count ?? 0,
    unverifiedEmployers: unverifiedEmployers.count ?? 0,
    newServiceInquiries: newServiceInquiries.count ?? 0,
    newKcnAdInquiries: newKcnAdInquiries.count ?? 0,
    newServicePartnerInquiries: newServicePartnerInquiries.count ?? 0,
    newAdPricingInquiries: newAdPricingInquiries.count ?? 0,
  };
}

// ─────────────────────────── Dashboard ───────────────────────────

export interface AdminDashboardStats {
  jobsByStatus: Record<AdminJobStatus, number>;
  totalCandidates: number;
  totalApplications: number;
  totalEmployers: number;
  unverifiedEmployers: number;
  revenueThisMonthVnd: number;
  ordersThisMonthCount: number;
  pendingOrdersCount: number;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const supabase = createSupabaseAdminClient();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [jobsByStatus, candidatesCount, applicationsCount, employersCount, unverifiedCount, ordersThisMonth, pendingOrders] =
    await Promise.all([
      getJobStatusCounts(),
      supabase.from("candidates").select("id", { count: "exact", head: true }),
      supabase.from("applications").select("id", { count: "exact", head: true }),
      supabase.from("employers").select("id", { count: "exact", head: true }),
      supabase.from("employers").select("id", { count: "exact", head: true }).eq("is_verified", false),
      supabase.from("orders").select("amount, status").gte("created_at", startOfMonth.toISOString()),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

  const revenueThisMonthVnd = (ordersThisMonth.data ?? [])
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + (o.amount ?? 0), 0);

  return {
    jobsByStatus,
    totalCandidates: candidatesCount.count ?? 0,
    totalApplications: applicationsCount.count ?? 0,
    totalEmployers: employersCount.count ?? 0,
    unverifiedEmployers: unverifiedCount.count ?? 0,
    revenueThisMonthVnd,
    ordersThisMonthCount: ordersThisMonth.data?.length ?? 0,
    pendingOrdersCount: pendingOrders.count ?? 0,
  };
}

// ───────────────────────────── Articles (Tin tức) ─────────────────────────────

export interface AdminArticleRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  content_format: "text" | "html";
  seo_description: string | null;
  cover_image_url: string | null;
  author_name: string | null;
  show_toc: boolean;
  category: string;
  read_minutes: number;
  status: "draft" | "published";
  published_at: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

const ADMIN_ARTICLE_SELECT =
  "id, slug, title, excerpt, content, content_format, seo_description, cover_image_url, author_name, show_toc, category, read_minutes, status, published_at, view_count, created_at, updated_at";

export async function getAdminArticles(): Promise<AdminArticleRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("articles")
    .select(ADMIN_ARTICLE_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminArticleRow[];
}

export interface ArticleInput {
  title: string;
  excerpt?: string;
  content: string;
  /** "html" = soạn bằng RichTextEditor, "text" = bài cũ soạn bằng textarea. */
  contentFormat?: "text" | "html";
  seoDescription?: string;
  coverImageUrl?: string;
  authorName?: string;
  showToc?: boolean;
  category: ArticleCategory;
  readMinutes: number;
  status: "draft" | "published";
}

type AdminContentMutationFailure = { ok: false; error: string; status: 400 | 404 | 409 | 500 };

export type AdminArticleMutationResult = { ok: true; article: AdminArticleRow } | AdminContentMutationFailure;

function validateArticleInput(input: ArticleInput): AdminContentMutationFailure | null {
  if (input.title.trim().length < 5) return { ok: false, error: "Tiêu đề tối thiểu 5 ký tự.", status: 400 };
  const plainContent =
    input.contentFormat === "html" ? htmlToPlainText(input.content) : input.content.trim();
  if (plainContent.length < 20) return { ok: false, error: "Nội dung tối thiểu 20 ký tự.", status: 400 };
  if (!isArticleCategory(input.category)) return { ok: false, error: "Danh mục không hợp lệ.", status: 400 };
  return null;
}

/** Chuẩn hoá phần dùng chung khi tạo/sửa: HTML luôn được sanitize trước khi ghi DB. */
function toArticleColumns(input: ArticleInput) {
  const contentFormat = input.contentFormat === "html" ? "html" : "text";
  return {
    title: input.title.trim(),
    excerpt: input.excerpt?.trim() || null,
    content: contentFormat === "html" ? sanitizeArticleHtml(input.content) : input.content.trim(),
    content_format: contentFormat,
    seo_description: input.seoDescription?.trim() || null,
    cover_image_url: input.coverImageUrl?.trim() || null,
    author_name: input.authorName?.trim() || null,
    show_toc: input.showToc ?? false,
    category: input.category,
    read_minutes: input.readMinutes,
    status: input.status,
  };
}

export async function createArticle(input: ArticleInput): Promise<AdminArticleMutationResult> {
  const validationError = validateArticleInput(input);
  if (validationError) return validationError;

  const supabase = createSupabaseAdminClient();
  const slug = slugify(input.title);
  const { data, error } = await supabase
    .from("articles")
    .insert({
      slug,
      ...toArticleColumns(input),
      published_at: input.status === "published" ? new Date().toISOString() : null,
    })
    .select(ADMIN_ARTICLE_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Tiêu đề này đã tồn tại (trùng đường dẫn) — hãy đổi tiêu đề khác.", status: 409 };
    }
    return { ok: false, error: "Không tạo được bài viết, thử lại sau.", status: 500 };
  }
  return { ok: true, article: data as AdminArticleRow };
}

export async function updateArticle(articleId: string, input: ArticleInput): Promise<AdminArticleMutationResult> {
  const validationError = validateArticleInput(input);
  if (validationError) return validationError;

  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("articles")
    .select("status, published_at")
    .eq("id", articleId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Không tìm thấy bài viết.", status: 404 };

  const nowPublishing = input.status === "published" && existing.status !== "published";
  const { data, error } = await supabase
    .from("articles")
    .update({
      ...toArticleColumns(input),
      published_at: nowPublishing ? new Date().toISOString() : existing.published_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId)
    .select(ADMIN_ARTICLE_SELECT)
    .single();

  if (error || !data) return { ok: false, error: "Không cập nhật được bài viết, thử lại sau.", status: 500 };
  return { ok: true, article: data as AdminArticleRow };
}

export async function deleteArticle(articleId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("articles").delete().eq("id", articleId);
  return !error;
}

/** Đăng/Ẩn nhanh 1 cú click từ bảng danh sách — không đụng title/content/category như
 * updateArticle() (dành cho modal Sửa). Ẩn KHÔNG xoá bài, chỉ đưa status về "draft" nên
 * không còn hiện ở trang Tin tức & Quyền lợi, Admin bấm Đăng lại bất cứ lúc nào. */
export async function setArticleStatus(articleId: string, status: "draft" | "published"): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("articles")
    .select("status, published_at")
    .eq("id", articleId)
    .maybeSingle();
  if (!existing) return false;

  const nowPublishing = status === "published" && existing.status !== "published";
  const { error } = await supabase
    .from("articles")
    .update({
      status,
      published_at: nowPublishing ? new Date().toISOString() : existing.published_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId);
  return !error;
}

// ─────────────────────── Right cards (Quyền lợi & Pháp lý) ───────────────────────

export interface AdminRightCardRow {
  id: string;
  slug: string;
  icon: string;
  title: string;
  summary: string;
  content: string | null;
  effective_note: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const ADMIN_RIGHT_CARD_SELECT =
  "id, slug, icon, title, summary, content, effective_note, sort_order, is_active, created_at, updated_at";

export async function getAdminRightCards(): Promise<AdminRightCardRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("right_cards")
    .select(ADMIN_RIGHT_CARD_SELECT)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminRightCardRow[];
}

export interface RightCardInput {
  icon: string;
  title: string;
  summary: string;
  content?: string;
  effectiveNote?: string;
  sortOrder: number;
  isActive: boolean;
}

export type AdminRightCardMutationResult = { ok: true; card: AdminRightCardRow } | AdminContentMutationFailure;

function validateRightCardInput(input: RightCardInput): AdminContentMutationFailure | null {
  if (input.title.trim().length < 2) return { ok: false, error: "Tiêu đề tối thiểu 2 ký tự.", status: 400 };
  if (input.summary.trim().length < 5) return { ok: false, error: "Nội dung tóm tắt tối thiểu 5 ký tự.", status: 400 };
  return null;
}

export async function createRightCard(input: RightCardInput): Promise<AdminRightCardMutationResult> {
  const validationError = validateRightCardInput(input);
  if (validationError) return validationError;

  const supabase = createSupabaseAdminClient();
  const slug = slugify(input.title);
  const { data, error } = await supabase
    .from("right_cards")
    .insert({
      slug,
      icon: input.icon.trim() || "⚖",
      title: input.title.trim(),
      summary: input.summary.trim(),
      content: input.content?.trim() || null,
      effective_note: input.effectiveNote?.trim() || null,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    })
    .select(ADMIN_RIGHT_CARD_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Tiêu đề này đã tồn tại (trùng đường dẫn) — hãy đổi tiêu đề khác.", status: 409 };
    }
    return { ok: false, error: "Không tạo được thẻ quyền lợi, thử lại sau.", status: 500 };
  }
  return { ok: true, card: data as AdminRightCardRow };
}

export async function updateRightCard(cardId: string, input: RightCardInput): Promise<AdminRightCardMutationResult> {
  const validationError = validateRightCardInput(input);
  if (validationError) return validationError;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("right_cards")
    .update({
      icon: input.icon.trim() || "⚖",
      title: input.title.trim(),
      summary: input.summary.trim(),
      content: input.content?.trim() || null,
      effective_note: input.effectiveNote?.trim() || null,
      sort_order: input.sortOrder,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId)
    .select(ADMIN_RIGHT_CARD_SELECT)
    .single();

  if (error || !data) return { ok: false, error: "Không cập nhật được thẻ quyền lợi, thử lại sau.", status: 500 };
  return { ok: true, card: data as AdminRightCardRow };
}

export async function deleteRightCard(cardId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("right_cards").delete().eq("id", cardId);
  return !error;
}

/** Đăng/Ẩn nhanh 1 cú click từ bảng danh sách — không đụng icon/title/summary/... như
 * updateRightCard() (dành cho modal Sửa). Ẩn KHÔNG xoá thẻ, chỉ đưa is_active về false
 * nên không còn hiện ở trang Quyền lợi & Pháp lý, Admin bấm Đăng lại bất cứ lúc nào. */
export async function setRightCardActive(cardId: string, isActive: boolean): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("right_cards")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", cardId);
  return !error;
}

// ─────────────────────── Quảng cáo theo KCN ───────────────────────

export type AdminKcnAdCardRow = KcnAdCardRow;

export interface KcnAdCardInput {
  icon: string;
  iconBg: string;
  title: string;
  category: string;
  tag: string;
  tagTone: string;
  description: string;
  packageLines: string[];
  ctaLabel: string;
  sortOrder: number;
  isActive: boolean;
}

const ADMIN_KCN_AD_CARD_SELECT =
  "id, icon, icon_bg, title, category, tag, tag_tone, description, package_lines, cta_label, sort_order, is_active, created_at, updated_at";

export async function getAdminKcnAdCards(): Promise<AdminKcnAdCardRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("kcn_ad_cards")
    .select(ADMIN_KCN_AD_CARD_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminKcnAdCardRow[];
}

function normalizeKcnAdCardInput(input: KcnAdCardInput): KcnAdCardInput {
  return {
    ...input,
    icon: input.icon.trim(),
    iconBg: input.iconBg.trim(),
    title: input.title.trim(),
    category: input.category.trim(),
    tag: input.tag.trim(),
    tagTone: input.tagTone.trim(),
    description: input.description.trim(),
    packageLines: input.packageLines.map((line) => line.trim()).filter(Boolean),
    ctaLabel: input.ctaLabel.trim(),
  };
}

function validateKcnAdCardInput(input: KcnAdCardInput): AdminContentMutationFailure | null {
  if (!input.icon.trim()) return { ok: false, error: "Vui lòng nhập icon.", status: 400 };
  if (input.title.trim().length < 2) return { ok: false, error: "Tên thẻ tối thiểu 2 ký tự.", status: 400 };
  if (!input.category.trim()) return { ok: false, error: "Vui lòng nhập nhóm dịch vụ.", status: 400 };
  if (input.description.trim().length < 10) return { ok: false, error: "Mô tả thẻ tối thiểu 10 ký tự.", status: 400 };
  if (input.packageLines.filter((line) => line.trim()).length === 0) {
    return { ok: false, error: "Vui lòng nhập ít nhất 1 dòng gói / giá.", status: 400 };
  }
  if (!input.ctaLabel.trim()) return { ok: false, error: "Vui lòng nhập nội dung nút.", status: 400 };
  return null;
}

export type AdminKcnAdCardMutationResult = { ok: true; card: AdminKcnAdCardRow } | AdminContentMutationFailure;

export async function createKcnAdCard(input: KcnAdCardInput): Promise<AdminKcnAdCardMutationResult> {
  const normalized = normalizeKcnAdCardInput(input);
  const validationError = validateKcnAdCardInput(normalized);
  if (validationError) return validationError;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("kcn_ad_cards")
    .insert({
      icon: normalized.icon,
      icon_bg: normalized.iconBg,
      title: normalized.title,
      category: normalized.category,
      tag: normalized.tag,
      tag_tone: normalized.tagTone,
      description: normalized.description,
      package_lines: normalized.packageLines,
      cta_label: normalized.ctaLabel,
      sort_order: normalized.sortOrder,
      is_active: normalized.isActive,
    })
    .select(ADMIN_KCN_AD_CARD_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Tên thẻ này đã tồn tại — hãy đổi tên khác.", status: 409 };
    }
    return { ok: false, error: "Không tạo được thẻ quảng cáo, thử lại sau.", status: 500 };
  }
  return { ok: true, card: data as AdminKcnAdCardRow };
}

export async function updateKcnAdCard(cardId: string, input: KcnAdCardInput): Promise<AdminKcnAdCardMutationResult> {
  const normalized = normalizeKcnAdCardInput(input);
  const validationError = validateKcnAdCardInput(normalized);
  if (validationError) return validationError;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("kcn_ad_cards")
    .update({
      icon: normalized.icon,
      icon_bg: normalized.iconBg,
      title: normalized.title,
      category: normalized.category,
      tag: normalized.tag,
      tag_tone: normalized.tagTone,
      description: normalized.description,
      package_lines: normalized.packageLines,
      cta_label: normalized.ctaLabel,
      sort_order: normalized.sortOrder,
      is_active: normalized.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId)
    .select(ADMIN_KCN_AD_CARD_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Tên thẻ này đã tồn tại — hãy đổi tên khác.", status: 409 };
    }
    return { ok: false, error: "Không cập nhật được thẻ quảng cáo, thử lại sau.", status: 500 };
  }
  return { ok: true, card: data as AdminKcnAdCardRow };
}

export async function deleteKcnAdCard(cardId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("kcn_ad_cards").delete().eq("id", cardId);
  return !error;
}

export async function setKcnAdCardActive(cardId: string, isActive: boolean): Promise<boolean> {
 const supabase = createSupabaseAdminClient();
 const { data, error } = await supabase
   .from("kcn_ad_cards")
   .update({ is_active: isActive, updated_at: new Date().toISOString() })
   .eq("id", cardId)
   .select("id")
   .maybeSingle();
 return !error && !!data;
}

// ─────────────────────── Dịch vụ trọn gói ───────────────────────

export type AdminServicePackageCardRow = ServicePackageCardRow;

export interface ServicePackageCardInput {
  icon: string;
  title: string;
  description: string;
  features: string[];
  price: string;
  ctaLabel: string;
  accent: ServicePackageCardRow["accent"];
  sortOrder: number;
  isActive: boolean;
}

const ADMIN_SERVICE_PACKAGE_CARD_SELECT =
  "id, icon, title, description, features, price, cta_label, accent, sort_order, is_active, created_at, updated_at";
const SERVICE_PACKAGE_ACCENTS = ["orange", "green", "amber", "red", "full"] as const;

export async function getAdminServicePackageCards(): Promise<AdminServicePackageCardRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_package_cards")
    .select(ADMIN_SERVICE_PACKAGE_CARD_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminServicePackageCardRow[];
}

function normalizeServicePackageCardInput(input: ServicePackageCardInput): ServicePackageCardInput {
  return {
    ...input,
    icon: input.icon.trim(),
    title: input.title.trim(),
    description: input.description.trim(),
    features: input.features.map((feature) => feature.trim()).filter(Boolean),
    price: input.price.trim(),
    ctaLabel: input.ctaLabel.trim(),
  };
}

function validateServicePackageCardInput(input: ServicePackageCardInput): AdminContentMutationFailure | null {
  if (!input.icon.trim()) return { ok: false, error: "Vui lòng nhập icon.", status: 400 };
  if (input.title.trim().length < 2) return { ok: false, error: "Tên dịch vụ tối thiểu 2 ký tự.", status: 400 };
  if (input.description.trim().length < 10) return { ok: false, error: "Mô tả dịch vụ tối thiểu 10 ký tự.", status: 400 };
  if (input.features.length === 0) return { ok: false, error: "Vui lòng nhập ít nhất 1 tính năng.", status: 400 };
  if (!input.price.trim()) return { ok: false, error: "Vui lòng nhập mức giá.", status: 400 };
  if (!input.ctaLabel.trim()) return { ok: false, error: "Vui lòng nhập nội dung nút.", status: 400 };
  if (!(SERVICE_PACKAGE_ACCENTS as readonly string[]).includes(input.accent)) {
    return { ok: false, error: "Màu nhấn không hợp lệ.", status: 400 };
  }
  return null;
}

export type AdminServicePackageCardMutationResult =
  | { ok: true; card: AdminServicePackageCardRow }
  | AdminContentMutationFailure;

export async function createServicePackageCard(
  input: ServicePackageCardInput,
): Promise<AdminServicePackageCardMutationResult> {
  const normalized = normalizeServicePackageCardInput(input);
  const validationError = validateServicePackageCardInput(normalized);
  if (validationError) return validationError;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_package_cards")
    .insert({
      icon: normalized.icon,
      title: normalized.title,
      description: normalized.description,
      features: normalized.features,
      price: normalized.price,
      cta_label: normalized.ctaLabel,
      accent: normalized.accent,
      sort_order: normalized.sortOrder,
      is_active: normalized.isActive,
    })
    .select(ADMIN_SERVICE_PACKAGE_CARD_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Tên dịch vụ này đã tồn tại — hãy đổi tên khác.", status: 409 };
    }
    return { ok: false, error: "Không tạo được dịch vụ, thử lại sau.", status: 500 };
  }
  return { ok: true, card: data as AdminServicePackageCardRow };
}

export async function updateServicePackageCard(
  cardId: string,
  input: ServicePackageCardInput,
): Promise<AdminServicePackageCardMutationResult> {
  const normalized = normalizeServicePackageCardInput(input);
  const validationError = validateServicePackageCardInput(normalized);
  if (validationError) return validationError;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_package_cards")
    .update({
      icon: normalized.icon,
      title: normalized.title,
      description: normalized.description,
      features: normalized.features,
      price: normalized.price,
      cta_label: normalized.ctaLabel,
      accent: normalized.accent,
      sort_order: normalized.sortOrder,
      is_active: normalized.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId)
    .select(ADMIN_SERVICE_PACKAGE_CARD_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Tên dịch vụ này đã tồn tại — hãy đổi tên khác.", status: 409 };
    }
    return { ok: false, error: "Không cập nhật được dịch vụ, thử lại sau.", status: 500 };
  }
  return { ok: true, card: data as AdminServicePackageCardRow };
}

export async function deleteServicePackageCard(cardId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("service_package_cards").delete().eq("id", cardId);
  return !error;
}

export async function setServicePackageCardActive(cardId: string, isActive: boolean): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_package_cards")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", cardId)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

// ─────────────────────── Đối tác dịch vụ ───────────────────────

export type AdminServicePartnerCardRow = ServicePartnerCardRow;

export interface ServicePartnerCardInput {
  icon: string;
  iconBg: string;
  title: string;
  category: string;
  tag: string;
  tagTone: string;
  description: string;
  packageLines: string[];
  ctaLabel: string;
  sortOrder: number;
  isActive: boolean;
}

const ADMIN_SERVICE_PARTNER_CARD_SELECT =
  "id, icon, icon_bg, title, category, tag, tag_tone, description, package_lines, cta_label, sort_order, is_active, created_at, updated_at";

export async function getAdminServicePartnerCards(): Promise<AdminServicePartnerCardRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_partner_cards")
    .select(ADMIN_SERVICE_PARTNER_CARD_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminServicePartnerCardRow[];
}

function normalizeServicePartnerCardInput(input: ServicePartnerCardInput): ServicePartnerCardInput {
  return {
    ...input,
    icon: input.icon.trim(),
    iconBg: input.iconBg.trim(),
    title: input.title.trim(),
    category: input.category.trim(),
    tag: input.tag.trim(),
    tagTone: input.tagTone.trim(),
    description: input.description.trim(),
    packageLines: input.packageLines.map((line) => line.trim()).filter(Boolean),
    ctaLabel: input.ctaLabel.trim(),
  };
}

function validateServicePartnerCardInput(input: ServicePartnerCardInput): AdminContentMutationFailure | null {
  if (!input.icon.trim()) return { ok: false, error: "Vui lòng nhập icon.", status: 400 };
  if (input.title.trim().length < 2) return { ok: false, error: "Tên đối tác tối thiểu 2 ký tự.", status: 400 };
  if (!input.category.trim()) return { ok: false, error: "Vui lòng nhập nhóm dịch vụ.", status: 400 };
  if (!input.tag.trim()) return { ok: false, error: "Vui lòng nhập nhãn đối tác.", status: 400 };
  if (input.description.trim().length < 10) return { ok: false, error: "Mô tả đối tác tối thiểu 10 ký tự.", status: 400 };
  if (input.packageLines.length === 0) return { ok: false, error: "Vui lòng nhập ít nhất 1 nội dung chi tiết.", status: 400 };
  if (!input.ctaLabel.trim()) return { ok: false, error: "Vui lòng nhập nội dung nút.", status: 400 };
  return null;
}

export type AdminServicePartnerCardMutationResult =
  | { ok: true; card: AdminServicePartnerCardRow }
  | AdminContentMutationFailure;

export async function createServicePartnerCard(
  input: ServicePartnerCardInput,
): Promise<AdminServicePartnerCardMutationResult> {
  const normalized = normalizeServicePartnerCardInput(input);
  const validationError = validateServicePartnerCardInput(normalized);
  if (validationError) return validationError;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_partner_cards")
    .insert({
      icon: normalized.icon,
      icon_bg: normalized.iconBg,
      title: normalized.title,
      category: normalized.category,
      tag: normalized.tag,
      tag_tone: normalized.tagTone,
      description: normalized.description,
      package_lines: normalized.packageLines,
      cta_label: normalized.ctaLabel,
      sort_order: normalized.sortOrder,
      is_active: normalized.isActive,
    })
    .select(ADMIN_SERVICE_PARTNER_CARD_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Tên đối tác này đã tồn tại — hãy đổi tên khác.", status: 409 };
    }
    return { ok: false, error: "Không tạo được đối tác, thử lại sau.", status: 500 };
  }
  return { ok: true, card: data as AdminServicePartnerCardRow };
}

export async function updateServicePartnerCard(
  cardId: string,
  input: ServicePartnerCardInput,
): Promise<AdminServicePartnerCardMutationResult> {
  const normalized = normalizeServicePartnerCardInput(input);
  const validationError = validateServicePartnerCardInput(normalized);
  if (validationError) return validationError;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_partner_cards")
    .update({
      icon: normalized.icon,
      icon_bg: normalized.iconBg,
      title: normalized.title,
      category: normalized.category,
      tag: normalized.tag,
      tag_tone: normalized.tagTone,
      description: normalized.description,
      package_lines: normalized.packageLines,
      cta_label: normalized.ctaLabel,
      sort_order: normalized.sortOrder,
      is_active: normalized.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId)
    .select(ADMIN_SERVICE_PARTNER_CARD_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Tên đối tác này đã tồn tại — hãy đổi tên khác.", status: 409 };
    }
    return { ok: false, error: "Không cập nhật được đối tác, thử lại sau.", status: 500 };
  }
  return { ok: true, card: data as AdminServicePartnerCardRow };
}

export async function deleteServicePartnerCard(cardId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("service_partner_cards").delete().eq("id", cardId);
  return !error;
}

export async function setServicePartnerCardActive(cardId: string, isActive: boolean): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_partner_cards")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", cardId)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

// ─────────────────────── Bảng giá quảng cáo ───────────────────────

export type AdminAdvertisingPricingCardRow = AdvertisingPricingCardRow;

export interface AdvertisingPricingCardInput {
  format: string;
  placement: string;
  price: string;
  unit: string;
  ctaLabel: string;
  sortOrder: number;
  isActive: boolean;
}

const ADMIN_ADVERTISING_PRICING_CARD_SELECT =
  "id, format, placement, price, unit, cta_label, sort_order, is_active, created_at, updated_at";

export async function getAdminAdvertisingPricingCards(): Promise<AdminAdvertisingPricingCardRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("advertising_pricing_cards")
    .select(ADMIN_ADVERTISING_PRICING_CARD_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminAdvertisingPricingCardRow[];
}

function normalizeAdvertisingPricingCardInput(input: AdvertisingPricingCardInput): AdvertisingPricingCardInput {
  return {
    ...input,
    format: input.format.trim(),
    placement: input.placement.trim(),
    price: input.price.trim(),
    unit: input.unit.trim(),
    ctaLabel: input.ctaLabel.trim(),
  };
}

function validateAdvertisingPricingCardInput(input: AdvertisingPricingCardInput): AdminContentMutationFailure | null {
  if (input.format.length < 2) return { ok: false, error: "Định dạng quảng cáo tối thiểu 2 ký tự.", status: 400 };
  if (!input.placement) return { ok: false, error: "Vui lòng nhập vị trí hiển thị.", status: 400 };
  if (!input.price) return { ok: false, error: "Vui lòng nhập giá quảng cáo.", status: 400 };
  if (!input.unit) return { ok: false, error: "Vui lòng nhập đơn vị / thời hạn.", status: 400 };
  if (!input.ctaLabel) return { ok: false, error: "Vui lòng nhập nội dung nút.", status: 400 };
  return null;
}

export type AdminAdvertisingPricingCardMutationResult =
  | { ok: true; card: AdminAdvertisingPricingCardRow }
  | AdminContentMutationFailure;

export async function createAdvertisingPricingCard(
  input: AdvertisingPricingCardInput,
): Promise<AdminAdvertisingPricingCardMutationResult> {
  const normalized = normalizeAdvertisingPricingCardInput(input);
  const validationError = validateAdvertisingPricingCardInput(normalized);
  if (validationError) return validationError;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("advertising_pricing_cards")
    .insert({
      format: normalized.format,
      placement: normalized.placement,
      price: normalized.price,
      unit: normalized.unit,
      cta_label: normalized.ctaLabel,
      sort_order: normalized.sortOrder,
      is_active: normalized.isActive,
    })
    .select(ADMIN_ADVERTISING_PRICING_CARD_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "Định dạng này đã tồn tại — hãy đổi tên khác.", status: 409 };
    return { ok: false, error: "Không tạo được bảng giá, thử lại sau.", status: 500 };
  }
  return { ok: true, card: data as AdminAdvertisingPricingCardRow };
}

export async function updateAdvertisingPricingCard(
  cardId: string,
  input: AdvertisingPricingCardInput,
): Promise<AdminAdvertisingPricingCardMutationResult> {
  const normalized = normalizeAdvertisingPricingCardInput(input);
  const validationError = validateAdvertisingPricingCardInput(normalized);
  if (validationError) return validationError;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("advertising_pricing_cards")
    .update({
      format: normalized.format,
      placement: normalized.placement,
      price: normalized.price,
      unit: normalized.unit,
      cta_label: normalized.ctaLabel,
      sort_order: normalized.sortOrder,
      is_active: normalized.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cardId)
    .select(ADMIN_ADVERTISING_PRICING_CARD_SELECT)
    .single();

  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "Định dạng này đã tồn tại — hãy đổi tên khác.", status: 409 };
    return { ok: false, error: "Không cập nhật được bảng giá, thử lại sau.", status: 500 };
  }
  return { ok: true, card: data as AdminAdvertisingPricingCardRow };
}

export async function deleteAdvertisingPricingCard(cardId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("advertising_pricing_cards").delete().eq("id", cardId);
  return !error;
}

export async function setAdvertisingPricingCardActive(cardId: string, isActive: boolean): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("advertising_pricing_cards")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", cardId)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

// ───────────────────────────── Hỏi đáp (qa_questions) ─────────────────────────────

export interface AdminQARow {
  id: string;
  question: string;
  full_name: string | null;
  contact: string | null;
  answer: string | null;
  status: "new" | "answered" | "published";
  sort_order: number;
  created_at: string;
}

// Thẻ Hỏi đáp cao (câu hỏi + textarea trả lời + nút hành động) nên để trang ngắn hơn
// các bảng danh sách khác trong admin (ADMIN_PAGE_SIZE=20) để đỡ phải cuộn quá dài.
export const ADMIN_QA_PAGE_SIZE = 5;

export async function getAdminQAQuestions(
  filters: { limit?: number; offset?: number } = {},
): Promise<{ questions: AdminQARow[]; total: number; newCount: number }> {
  const supabase = createSupabaseAdminClient();
  const limit = filters.limit ?? ADMIN_QA_PAGE_SIZE;
  const offset = filters.offset ?? 0;
  const [{ data, error, count }, newCountRes] = await Promise.all([
    supabase
      .from("qa_questions")
      .select("id, question, full_name, contact, answer, status, sort_order, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    // Đếm riêng trên TOÀN BỘ bảng (không giới hạn trang hiện tại) — hiển thị ở dòng mô
    // tả đầu trang, khác với danh sách `questions` chỉ chứa đúng 1 trang.
    supabase.from("qa_questions").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  if (error) throw new Error(error.message);
  return { questions: (data ?? []) as AdminQARow[], total: count ?? 0, newCount: newCountRes.count ?? 0 };
}

/** Trả lời câu hỏi, tuỳ chọn "duyệt" (publish=true) để đăng công khai vào danh sách
 * FAQ ở /tin-tuc-quyen-loi/hoi-dap — gán sort_order cuối cùng để hiện sau các FAQ hiện có. */
export async function answerQAQuestion(questionId: string, answer: string, publish: boolean): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  let sortOrder: number | undefined;
  if (publish) {
    const { data: maxRow } = await supabase
      .from("qa_questions")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (maxRow?.sort_order ?? 0) + 1;
  }

  const { error } = await supabase
    .from("qa_questions")
    .update({
      answer: answer.trim(),
      status: publish ? "published" : "answered",
      answered_at: new Date().toISOString(),
      ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
    })
    .eq("id", questionId);
  return !error;
}

export async function unpublishQAQuestion(questionId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("qa_questions").update({ status: "answered" }).eq("id", questionId);
  return !error;
}

export async function deleteQAQuestion(questionId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("qa_questions").delete().eq("id", questionId);
  return !error;
}

// ─────────────────────── Yêu cầu tư vấn dịch vụ ───────────────────────

const SERVICE_INQUIRY_STATUSES = ["new", "consulted", "cancelled"] as const;
export type AdminServiceInquiryStatus = (typeof SERVICE_INQUIRY_STATUSES)[number];

export function isServiceInquiryStatus(value: string): value is AdminServiceInquiryStatus {
  return (SERVICE_INQUIRY_STATUSES as readonly string[]).includes(value);
}

export type AdminServiceInquiryRow = ServiceInquiryRow;

export const ADMIN_SERVICE_INQUIRY_PAGE_SIZE = ADMIN_PAGE_SIZE;

export async function getAdminServiceInquiries(
  filters: {
    q?: string;
    status?: AdminServiceInquiryStatus;
    type?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ inquiries: AdminServiceInquiryRow[]; total: number; newCount: number }> {
  const supabase = createSupabaseAdminClient();
  const limit = filters.limit ?? ADMIN_SERVICE_INQUIRY_PAGE_SIZE;
  const offset = filters.offset ?? 0;
  let query = supabase
    .from("service_inquiries")
    .select("id, type, service_name, company_name, phone, phone_normalized, email, request, kcn_target, cancel_reason, status, created_at, consulted_at", {
      count: "exact",
    })
    // Ưu tiên yêu cầu mới; các yêu cầu đã tư vấn/cancelled được đẩy xuống dưới.
    .order("status", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.type) query = query.eq("type", filters.type);
  const search = filters.q?.trim().replace(/[(),]/g, " ");
  if (search) {
    const pattern = `%${search}%`;
    query = query.or(
      `service_name.ilike.${pattern},company_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern},request.ilike.${pattern},kcn_target.ilike.${pattern}`,
    );
  }

  let newCountQuery = supabase.from("service_inquiries").select("id", { count: "exact", head: true }).eq("status", "new");
  if (filters.type) newCountQuery = newCountQuery.eq("type", filters.type);

  const [{ data, error, count }, newCountRes] = await Promise.all([
    query.range(offset, offset + limit - 1),
    newCountQuery,
  ]);

  if (error) throw new Error(error.message);
  return {
    inquiries: (data ?? []) as AdminServiceInquiryRow[],
    total: count ?? 0,
    newCount: newCountRes.count ?? 0,
  };
}

export async function updateServiceInquiryStatus(
  inquiryId: string,
  status: AdminServiceInquiryStatus,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const update =
    status === "consulted" ? { status, consulted_at: new Date().toISOString() } : { status, consulted_at: null };
  const { data, error } = await supabase
    .from("service_inquiries")
    .update(update)
    .eq("id", inquiryId)
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

// ───────────────────────────── KCN (Khu công nghiệp) ─────────────────────────────

export interface KcnInput {
  name: string;
  provinceCode: string;
  address?: string;
  totalAreaHa?: number;
  occupiedPct?: number;
  activeCompanies?: number;
  industries?: string[];
  lat?: number;
  lng?: number;
}

export type AdminKcnMutationResult = { ok: true; kcn: KcnRow } | AdminContentMutationFailure;

function validateKcnInput(input: KcnInput): AdminContentMutationFailure | null {
  if (input.name.trim().length < 3) return { ok: false, error: "Tên KCN tối thiểu 3 ký tự.", status: 400 };
  if (!PROVINCES.some((p) => p.code === input.provinceCode)) {
    return { ok: false, error: "Tỉnh/thành không hợp lệ.", status: 400 };
  }
  if (input.occupiedPct !== undefined && (input.occupiedPct < 0 || input.occupiedPct > 100)) {
    return { ok: false, error: "Tỷ lệ lấp đầy phải trong khoảng 0–100%.", status: 400 };
  }
  return null;
}

export async function createKcn(input: KcnInput): Promise<AdminKcnMutationResult> {
  const validationError = validateKcnInput(input);
  if (validationError) return validationError;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("kcn")
    .insert({
      name: input.name.trim(),
      province_code: input.provinceCode,
      province_name: provinceName(input.provinceCode),
      address: input.address?.trim() || null,
      total_area_ha: input.totalAreaHa ?? null,
      occupied_pct: input.occupiedPct ?? null,
      active_companies: input.activeCompanies ?? 0,
      industries: input.industries?.length ? input.industries : null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Tên KCN này đã tồn tại — hãy đổi tên khác.", status: 409 };
    }
    return { ok: false, error: "Không tạo được KCN, thử lại sau.", status: 500 };
  }
  return { ok: true, kcn: data as KcnRow };
}

export async function updateKcn(kcnId: string, input: KcnInput): Promise<AdminKcnMutationResult> {
  const validationError = validateKcnInput(input);
  if (validationError) return validationError;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("kcn")
    .update({
      name: input.name.trim(),
      province_code: input.provinceCode,
      province_name: provinceName(input.provinceCode),
      address: input.address?.trim() || null,
      total_area_ha: input.totalAreaHa ?? null,
      occupied_pct: input.occupiedPct ?? null,
      active_companies: input.activeCompanies ?? 0,
      industries: input.industries?.length ? input.industries : null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
    })
    .eq("id", kcnId)
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { ok: false, error: "Tên KCN này đã tồn tại — hãy đổi tên khác.", status: 409 };
    }
    return { ok: false, error: "Không cập nhật được KCN, thử lại sau.", status: 500 };
  }
  return { ok: true, kcn: data as KcnRow };
}

export async function deleteKcn(kcnId: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  // jobs.kcn_id có ON DELETE SET NULL (xem migration create_jobs) — xoá KCN không làm
  // mất tin tuyển dụng đang tham chiếu, chỉ gỡ liên kết KCN của các tin đó.
  const { error } = await supabase.from("kcn").delete().eq("id", kcnId);
  return !error;
}
