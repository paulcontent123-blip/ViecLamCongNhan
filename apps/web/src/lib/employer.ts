import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CAMPAIGN_BLAST_BUDGET_VND, JOB_ADDONS, type JobAddon } from "@/lib/packages";
import { normalizeIndustryText, industryLikePattern } from "@/lib/industries";
import { ACCOUNT_TIERS, isAccountTier, type AccountTier, type PaidAccountTier } from "@/lib/account-tiers";
import type { PaymentMethod } from "@/lib/payment-method";
import type { CampaignTheme } from "@/lib/campaign-theme";
import type { ApplicationStatus } from "@/lib/application-status";
import { normalizePhone } from "@/lib/phone";
import type { ServiceInquiryRow } from "@/types/db";

// Toàn bộ hàm ở đây dùng service-role client (bypass RLS) vì NTD không xác thực
// qua Supabase Auth — quyền truy cập chỉ được đảm bảo bởi việc LUÔN scope theo
// employerId lấy từ employer_session đã verify ở route/page gọi vào, KHÔNG BAO
// GIỜ nhận employerId trực tiếp từ input client.

export async function getEmployerById(employerId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("employers")
    .select("*")
    .eq("id", employerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

const EMPLOYER_SERVICE_INQUIRY_SELECT =
  "id, type, service_name, company_name, phone, phone_normalized, email, request, kcn_target, cancel_reason, status, created_at, consulted_at";

async function getEmployerPhoneKeys(employerId: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("employers")
    .select("contact_phone, users(phone)")
    .eq("id", employerId)
    .maybeSingle();
  if (!data) return [];

  const linkedUser = Array.isArray(data.users) ? data.users[0] : data.users;
  return [...new Set([data.contact_phone, linkedUser?.phone].map((phone) => normalizePhone(phone ?? "")).filter(Boolean))];
}

export async function getEmployerServiceInquiries(employerId: string): Promise<ServiceInquiryRow[]> {
  const phoneKeys = await getEmployerPhoneKeys(employerId);
  if (phoneKeys.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_inquiries")
    .select(EMPLOYER_SERVICE_INQUIRY_SELECT)
    .in("phone_normalized", phoneKeys)
    .order("status", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceInquiryRow[];
}

export async function cancelEmployerServiceInquiry(
  employerId: string,
  inquiryId: string,
  reason: string,
): Promise<{ ok: true; inquiry: ServiceInquiryRow } | { ok: false; error: string; status: 400 | 404 | 500 }> {
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 3) return { ok: false, error: "Vui lòng nhập lý do hủy tư vấn.", status: 400 };
  if (trimmedReason.length > 1000) return { ok: false, error: "Lý do hủy tối đa 1.000 ký tự.", status: 400 };

  const phoneKeys = await getEmployerPhoneKeys(employerId);
  if (phoneKeys.length === 0) return { ok: false, error: "Không xác định được số điện thoại tài khoản.", status: 404 };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_inquiries")
    .update({ status: "cancelled", cancel_reason: trimmedReason })
    .eq("id", inquiryId)
    .eq("status", "new")
    .in("phone_normalized", phoneKeys)
    .select(EMPLOYER_SERVICE_INQUIRY_SELECT)
    .maybeSingle();

  if (error) return { ok: false, error: "Không hủy được yêu cầu tư vấn, vui lòng thử lại.", status: 500 };
  if (!data) return { ok: false, error: "Yêu cầu không tồn tại, đã được tư vấn hoặc không thuộc tài khoản này.", status: 404 };
  return { ok: true, inquiry: data as ServiceInquiryRow };
}

/**
 * Chốt bảo mật cho toàn bộ hành động ghi dữ liệu của NTD (đăng tin, mua gói,
 * Blast, cập nhật ứng viên, sửa hồ sơ). employer_session (JWT) không mang theo
 * is_verified — session sống 30 ngày nên phải đọc DB trực tiếp mỗi lần mới phản
 * ánh đúng trạng thái xác minh hiện tại (Admin có thể xác minh/huỷ xác minh bất
 * kỳ lúc nào giữa phiên đăng nhập). cache() dedupe trong 1 request khi layout +
 * page cùng cần giá trị này.
 */
export const isEmployerVerified = cache(async (employerId: string): Promise<boolean> => {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("employers").select("is_verified").eq("id", employerId).maybeSingle();
  return data?.is_verified ?? false;
});

export interface EmployerProfile {
  id: string;
  company_name: string;
  company_slug: string;
  company_logo_url: string | null;
  industry: string | null;
  province_code: string | null;
  tax_code: string | null;
  contact_phone: string;
  is_verified: boolean;
  account_type: string;
  account_tier_expires_at: string | null;
  users: { email: string | null; full_name: string; phone: string | null } | null;
}

/** Toàn bộ thông tin hồ sơ (employers + users liên kết) cho trang "Thông tin tài khoản". */
export async function getEmployerProfile(employerId: string): Promise<EmployerProfile | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("employers")
    .select(
      "id, company_name, company_slug, company_logo_url, industry, province_code, tax_code, contact_phone, is_verified, account_type, account_tier_expires_at, users(email, full_name, phone)",
    )
    .eq("id", employerId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as EmployerProfile;
}

/**
 * Gói thuê bao tài khoản hiện hành (free/basic/premium). Basic/Premium hết hạn (qua
 * account_tier_expires_at) mà chưa gia hạn sẽ tự động hạ về Free ngay khi đọc — tin đã
 * đăng trước đó giữ nguyên, không bị ẩn hay xoá.
 */
export const getEmployerAccountTier = cache(async (employerId: string): Promise<AccountTier> => {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("employers")
    .select("account_type, account_tier_expires_at")
    .eq("id", employerId)
    .maybeSingle();

  const rawTier = data?.account_type ?? "free";
  const tier: AccountTier = isAccountTier(rawTier) ? rawTier : "free";

  if (tier !== "free" && data?.account_tier_expires_at && new Date(data.account_tier_expires_at) < new Date()) {
    await supabase
      .from("employers")
      .update({ account_type: "free", account_tier_expires_at: null })
      .eq("id", employerId);
    return "free";
  }

  return tier;
});

export interface UpdateProfileInput {
  companyName: string;
  contactPhone: string;
  fullName: string;
  taxCode?: string;
  provinceCode?: string;
  industry?: string;
}

/** Không cho sửa email/company_slug ở đây — email là định danh đăng nhập, đổi cần
 * luồng xác thực riêng (chưa xây); company_slug ảnh hưởng đường dẫn công khai. */
export async function updateEmployerProfile(
  employerId: string,
  userId: string,
  input: UpdateProfileInput,
): Promise<{ error: string; uncertain?: boolean } | { ok: true }> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.rpc("update_employer_profile_atomically", {
    p_employer_id: employerId,
    p_user_id: userId,
    p_company_name: input.companyName,
    p_contact_phone: input.contactPhone,
    p_full_name: input.fullName,
    p_tax_code: input.taxCode?.trim() || null,
    p_province_code: input.provinceCode?.trim() || null,
    p_industry: input.industry?.trim() || null,
  });

  if (error) return { error: "Chưa xác định được hồ sơ đã cập nhật hay chưa. Tải lại hồ sơ trước khi thử lại.", uncertain: true };
  if (data !== true) return { error: "Hồ sơ không thuộc tài khoản hoặc doanh nghiệp chưa được xác minh." };

  return { ok: true };
}

export async function getEmployerJobs(employerId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, slug, title, tier, status, view_count, apply_count, expires_at, created_at, province_code, industry",
    )
    .eq("employer_id", employerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

const EMPLOYER_CAMPAIGN_LIST_SELECT =
  "id, slug, title, status, quantity, apply_count, view_count, expires_at, created_at, campaign_theme, campaign_story";

// Đầy đủ mọi field NTD sửa được ở trang chỉnh sửa chiến dịch — không chỉ banner
// theme/story như trước, mà cả nội dung tin đăng gốc (tiêu đề, mô tả, lương...),
// giống hệt bộ field ở PostJobForm lúc đăng tin mới.
const EMPLOYER_CAMPAIGN_EDIT_SELECT =
  "id, slug, title, status, quantity, apply_count, view_count, expires_at, created_at, campaign_theme, campaign_story, description, requirements, salary_min, salary_max, job_type, province_code, district, industry, is_urgent, has_housing, has_shuttle, has_meals, no_experience_required, shift_type";

/** Tổng số ứng viên đã được auto-blast Zalo lúc mua gói, gắn với 1 chiến dịch (job_id)
 * — xem runCampaignAutoBlast. Không phải phí Blast NTD tự mua thêm ở BlastTab. */
async function getCampaignBlastSentCount(jobId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("sms_blasts").select("recipient_count").eq("job_id", jobId);
  return (data ?? []).reduce((sum, row) => sum + (row.recipient_count ?? 0), 0);
}

/** Toàn bộ tin tier='campaign' của NTD — 1 NTD có thể chạy nhiều chiến dịch cùng lúc. */
export async function getEmployerCampaigns(employerId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(EMPLOYER_CAMPAIGN_LIST_SELECT)
    .eq("employer_id", employerId)
    .eq("tier", "campaign")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const campaigns = data ?? [];
  const withBlastCount = await Promise.all(
    campaigns.map(async (c) => ({ ...c, blast_sent_count: await getCampaignBlastSentCount(c.id) })),
  );
  return withBlastCount;
}

/** .eq('employer_id', employerId) là chốt bảo mật — NTD chỉ sửa được chiến dịch của
 * chính mình, kể cả khi lỡ đoán được id chiến dịch khác. */
export async function getEmployerCampaignById(employerId: string, jobId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(EMPLOYER_CAMPAIGN_EDIT_SELECT)
    .eq("id", jobId)
    .eq("employer_id", employerId)
    .eq("tier", "campaign")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return data;
  return { ...data, blast_sent_count: await getCampaignBlastSentCount(data.id) };
}

export interface CampaignEditInput {
  theme: CampaignTheme;
  story?: string;
  title: string;
  description: string;
  requirements?: string;
  salaryMin?: number;
  salaryMax?: number;
  jobType?: "full_time" | "part_time" | "seasonal";
  provinceCode: string;
  district?: string;
  industry: string;
  quantity?: number;
  isUrgent?: boolean;
  hasHousing?: boolean;
  hasShuttle?: boolean;
  hasMeals?: boolean;
  noExperienceRequired?: boolean;
  shiftType?: "day" | "night" | "rotating";
}

/** Sửa trực tiếp tin đang hiển thị (không đưa về "pending" chờ duyệt lại) — chiến
 * dịch là nội dung đã trả phí, NTD cần sửa nhanh mà không mất hiển thị. */
export async function updateEmployerCampaign(
  employerId: string,
  jobId: string,
  input: CampaignEditInput,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("jobs")
    .update({
      campaign_theme: input.theme,
      campaign_story: input.story?.trim() || null,
      title: input.title.trim(),
      description: input.description.trim(),
      requirements: input.requirements?.trim() || null,
      salary_min: input.salaryMin ?? null,
      salary_max: input.salaryMax ?? null,
      job_type: input.jobType ?? null,
      province_code: input.provinceCode,
      district: input.district?.trim() || null,
      industry: input.industry,
      quantity: input.quantity ?? 1,
      is_urgent: input.isUrgent ?? false,
      has_housing: input.hasHousing ?? false,
      has_shuttle: input.hasShuttle ?? false,
      has_meals: input.hasMeals ?? false,
      no_experience_required: input.noExperienceRequired ?? false,
      shift_type: input.shiftType ?? null,
    })
    .eq("id", jobId)
    .eq("employer_id", employerId)
    .eq("tier", "campaign")
    .select("id")
    .maybeSingle();
  return !error && !!data;
}

export async function countJobsPostedToday(employerId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("employer_id", employerId)
    .gte("created_at", startOfToday.toISOString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export interface CreateJobInput {
  title: string;
  description: string;
  requirements?: string;
  salaryMin?: number;
  salaryMax?: number;
  jobType?: "full_time" | "part_time" | "seasonal";
  provinceCode: string;
  district?: string;
  kcnId?: string;
  industry: string;
  quantity?: number;
  isUrgent?: boolean;
  hasHousing?: boolean;
  hasShuttle?: boolean;
  hasMeals?: boolean;
  noExperienceRequired?: boolean;
  shiftType?: "day" | "night" | "rotating";
  wantsCampaign?: boolean;
  campaignMessage?: string;
  paymentMethod?: PaymentMethod;
}

export async function createEmployerJob(employerId: string, input: CreateJobInput) {
  const slugBase = input.title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const slug = `${slugBase}-${Date.now().toString(36)}`;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("create_employer_job_with_quota", {
    p_employer_id: employerId,
    p_slug: slug,
    p_job: {
      title: input.title,
      description: input.description,
      requirements: input.requirements || "",
      salaryMin: input.salaryMin ?? "",
      salaryMax: input.salaryMax ?? "",
      jobType: input.jobType ?? "",
      provinceCode: input.provinceCode,
      district: input.district || "",
      kcnId: input.kcnId || "",
      industry: input.industry,
      quantity: input.quantity ?? 1,
      isUrgent: input.isUrgent ?? false,
      hasHousing: input.hasHousing ?? false,
      hasShuttle: input.hasShuttle ?? false,
      hasMeals: input.hasMeals ?? false,
      noExperienceRequired: input.noExperienceRequired ?? false,
      shiftType: input.shiftType ?? "",
      wantsCampaign: input.wantsCampaign ?? false,
      campaignMessage: input.campaignMessage ?? "",
      paymentMethod: input.paymentMethod ?? "",
      campaignPrice: input.wantsCampaign ? JOB_ADDONS.campaign.priceVnd : "",
    },
  });

  if (error) return { error: "Chưa xác định được tin đã lưu hay chưa. Kiểm tra danh sách tin trước khi gửi lại.", uncertain: true };
  const result = data as { ok?: boolean; code?: string; tier?: AccountTier; dailyLimit?: number; job?: { id: string; slug: string }; order?: { id: string; tier: string; amount: number; status: string; created_at: string } | null } | null;
  if (!result?.ok || !result.job) {
    if (result?.code === "daily_limit") {
      const tier = result.tier && isAccountTier(result.tier) ? result.tier : "free";
      const limit = result.dailyLimit ?? ACCOUNT_TIERS[tier].dailyPostLimit;
      return { error: `Gói ${ACCOUNT_TIERS[tier].label} chỉ được đăng ${limit} tin/ngày. Nâng cấp gói để đăng nhiều tin hơn mỗi ngày.` };
    }
    if (result?.code === "employer_not_verified") return { error: "Tài khoản của bạn đang chờ Admin xác minh pháp nhân. Vui lòng chờ xác minh để đăng tin." };
    return { error: "Không đăng được tin tuyển dụng. Hãy kiểm tra lại hồ sơ doanh nghiệp." };
  }

  // Nếu NTD có mua thêm gói Chiến dịch, tin vẫn ở tier bình thường (accountTier) tới
  // đây — việc nâng tier='campaign' + auto-blast Zalo chỉ chạy SAU KHI Admin xác nhận
  // đã nhận thanh toán đơn hàng addon (xem activateCampaignFromOrder, gọi từ
  // updateOrderStatus ở admin.ts), không chạy ngay lúc NTD tự khai đã thanh toán.
  return { job: result.job, tier: result.tier, order: result.order ?? null };
}

export interface EmployerApplicationRow {
  id: string;
  status: string;
  cover_note: string | null;
  created_at: string;
  updated_at: string;
  jobs: { title: string; slug: string } | null;
  // Thông tin liên hệ (phone/zalo) KHÔNG lấy ở đây — ứng viên tự ứng tuyển vào tin
  // vẫn tính vào cùng hạn mức xem hồ sơ/tháng như duyệt database (xem
  // recordCandidateProfileView), chỉ lộ ra khi NTD bấm "Xem hồ sơ" trên UI.
  candidates: {
    id: string;
    full_name: string;
    province: string | null;
    desired_industry: string | null;
    experience_years: number | null;
  } | null;
}

export async function getEmployerApplications(employerId: string): Promise<EmployerApplicationRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, status, cover_note, created_at, updated_at, jobs(title, slug), candidates(id, full_name, province, desired_industry, experience_years)",
    )
    .eq("employer_id", employerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EmployerApplicationRow[];
}

export async function updateEmployerApplicationStatus(
  employerId: string,
  applicationId: string,
  status: ApplicationStatus,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  // .eq('employer_id', employerId) là chốt bảo mật: NTD chỉ sửa được application
  // thuộc chính tin của mình, kể cả khi lỡ đoán được id của application khác.
  const { data, error } = await supabase
    .from("applications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("employer_id", employerId)
    .select("id")
    .maybeSingle();
  if (error || !data) return false;
  return true;
}

export async function getEmployerOrders(employerId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_type, tier, amount, payment_method, status, created_at, paid_at")
    .eq("employer_id", employerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Mua thêm gói Chiến dịch cho 1 tin cụ thể — độc lập với thuê bao tài khoản.
 * paymentMethod optional vì lời gọi từ luồng đăng tin (checkbox "mua thêm Chiến
 * dịch") tạo đơn tự động, không đi qua modal chọn phương thức thanh toán. jobId +
 * campaignMessage lưu vào đơn hàng để activateCampaignFromOrder dùng lại khi Admin
 * xác nhận đã nhận thanh toán — CHƯA nâng tier/gửi Zalo ngay lúc tạo đơn. */
export async function createJobAddonOrder(
  employerId: string,
  addon: JobAddon,
  paymentMethod?: PaymentMethod,
  campaignExtra?: { jobId: string; campaignMessage: string },
) {
  const pkg = JOB_ADDONS[addon];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .insert({
      employer_id: employerId,
      order_type: pkg.orderType,
      tier: addon,
      amount: pkg.priceVnd,
      payment_method: paymentMethod ?? null,
      job_id: campaignExtra?.jobId ?? null,
      campaign_message: campaignExtra?.campaignMessage ?? null,
      status: "pending",
    })
    .select("id, tier, amount, status, created_at")
    .single();
  if (error || !data) return { error: "Không tạo được đơn hàng, thử lại sau." };
  return { order: data };
}

/** Kích hoạt gói Chiến dịch cho 1 tin — gọi DUY NHẤT khi Admin xác nhận đã nhận
 * thanh toán đơn hàng addon (orders.status='paid', order_type='job_post',
 * tier='campaign') từ updateOrderStatus ở admin.ts. Trước thời điểm này tin vẫn ở
 * tier bình thường và KHÔNG có ứng viên nào được auto-blast — tránh kích hoạt quyền
 * lợi trả phí (banner, top danh sách, gửi Zalo tốn hạn mức) khi NTD mới chỉ tự khai
 * đã thanh toán, chưa được Admin xác minh thực sự nhận được tiền. */
export async function activateCampaignFromOrder(
  employerId: string,
  jobId: string,
  campaignMessage: string | null,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, tier, title, industry, province_code")
    .eq("id", jobId)
    .eq("employer_id", employerId)
    .maybeSingle();
  if (!job || job.tier === "campaign") return;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + JOB_ADDONS.campaign.durationDays);

  const { error } = await supabase
    .from("jobs")
    .update({ tier: "campaign", expires_at: expiresAt.toISOString() })
    .eq("id", jobId)
    .eq("employer_id", employerId);
  if (error) return;

  await runCampaignAutoBlast(employerId, job, campaignMessage ?? "");
}

export interface CampaignAutoBlastResult {
  matched: number;
  sentCount: number;
  costVnd: number;
}

/** Tự động gửi tin Zalo cho ứng viên form_quick cùng ngành nghề + tỉnh thành với
 * chiến dịch, ngay khi mua/nâng cấp gói — dùng tối đa CAMPAIGN_BLAST_BUDGET_VND
 * (1tr trong giá 1.5tr gói) theo đơn giá Zalo hiện hành (BLAST_CHANNEL_RATES.zalo),
 * gửi hết mức có thể nếu không đủ ứng viên khớp để dùng hết hạn mức. Chỉ tính toán
 * + lưu số liệu vào sms_blasts (status='queued'), CHƯA gọi cổng Zalo thật — giống
 * mọi Blast khác trong hệ thống hiện nay. Không tạo order riêng vì đã nằm trong giá
 * gói Chiến dịch (khác Blast NTD tự mua thêm ở BlastTab).
 */
export async function runCampaignAutoBlast(
  employerId: string,
  job: { id: string; title: string; industry: string; province_code: string },
  message: string,
): Promise<CampaignAutoBlastResult> {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("candidates")
    .select("id", { count: "exact", head: true })
    .eq("source", "quick_form")
    // desired_industry_key so khớp không phân biệt hoa/thường + không dấu (xem
    // migration 20260820110001) — NTD/ứng viên có thể gõ tự do khác chính tả nhau
    // dù cùng 1 ngành thật, so chuỗi tuyệt đối sẽ bỏ sót ứng viên.
    .eq("desired_industry_key", normalizeIndustryText(job.industry))
    .eq("province", job.province_code);

  const matched = count ?? 0;
  const rate = BLAST_CHANNEL_RATES.zalo.priceVnd;
  const maxByBudget = Math.floor(CAMPAIGN_BLAST_BUDGET_VND / rate);
  const sentCount = Math.min(matched, maxByBudget);
  const costVnd = sentCount * rate;

  if (sentCount > 0) {
    await supabase.from("sms_blasts").insert({
      job_id: job.id,
      employer_id: employerId,
      campaign_name: job.title,
      target_provinces: [job.province_code],
      target_industries: [job.industry],
      message,
      channel: "zalo",
      recipient_count: sentCount,
      cost_vnd: costVnd,
      status: "queued",
    });
  }

  return { matched, sentCount, costVnd };
}

/** Đăng ký/gia hạn thuê bao tài khoản Basic hoặc Premium (399k / 899k mỗi tháng).
 * Đơn hàng ở trạng thái "pending" — account_type chỉ được kích hoạt khi Admin xác
 * nhận đã thanh toán (xem admin.ts updateOrderStatus). NTD đã bấm "Xác nhận thanh
 * toán" ở modal trước khi hàm này được gọi, nên "pending" ở đây nghĩa là "đã thanh
 * toán (tự khai), chờ Admin xác nhận" chứ không phải "chưa làm gì". */
export async function createAccountSubscriptionOrder(
  employerId: string,
  tier: PaidAccountTier,
  paymentMethod: PaymentMethod,
) {
  const perks = ACCOUNT_TIERS[tier];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .insert({
      employer_id: employerId,
      order_type: "account_subscription",
      tier,
      amount: perks.priceVnd,
      payment_method: paymentMethod,
      status: "pending",
    })
    .select("id, tier, amount, status, created_at")
    .single();
  if (error || !data) return { error: "Không tạo được đơn hàng, thử lại sau." };
  return { order: data };
}

// Blast SMS/Zalo — đơn giá theo bản HTML gốc.
export const BLAST_CHANNEL_RATES = {
  sms: { label: "SMS", priceVnd: 500 },
  zalo: { label: "Zalo OA", priceVnd: 300 },
  combo: { label: "Combo SMS+Zalo", priceVnd: 700 },
} as const;
export type BlastChannel = keyof typeof BLAST_CHANNEL_RATES;
const READ_RATE_PCT = 37; // tỷ lệ đọc trung bình — số cố định tham khảo ngành, không phải số ảo random

export interface BlastEstimateInput {
  targetProvince?: string;
  targetIndustry?: string;
  channel: BlastChannel;
  /** NTD tự giới hạn số lượng gửi để tiết kiệm chi phí — để trống nghĩa là gửi hết
   * `reach`. Khi có giới hạn, ứng viên được chọn luôn là những người MỚI NHẤT (mới
   * điền form nhanh hoặc mới ứng tuyển — sắp theo created_at desc), không phải lấy
   * ngẫu nhiên hay ưu tiên ứng viên cũ. */
  quantity?: number;
}

/**
 * Ước tính reach dựa trên số ứng viên THẬT trong bảng candidates khớp bộ lọc
 * — khác bản HTML demo cũ dùng Math.random() giả lập con số.
 */
export async function estimateBlastReach(input: BlastEstimateInput) {
  const supabase = createSupabaseAdminClient();

  let countQuery = supabase.from("candidates").select("id", { count: "exact", head: true });
  if (input.targetProvince) countQuery = countQuery.eq("province", input.targetProvince);
  if (input.targetIndustry) countQuery = countQuery.ilike("desired_industry_key", industryLikePattern(input.targetIndustry));
  const { count, error } = await countQuery;
  if (error) return { reach: 0, recipientCount: 0, readRatePct: READ_RATE_PCT, priceVnd: 0 };

  const reach = count ?? 0;
  let recipientCount = reach;

  // Giới hạn số lượng: lấy đúng N ứng viên mới nhất khớp bộ lọc (không chỉ đếm) để
  // đảm bảo đúng ứng viên "vừa điền form/apply" được gửi, không phải suy ra bằng số học.
  if (input.quantity && input.quantity < reach) {
    let idsQuery = supabase
      .from("candidates")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(input.quantity);
    if (input.targetProvince) idsQuery = idsQuery.eq("province", input.targetProvince);
    if (input.targetIndustry) idsQuery = idsQuery.ilike("desired_industry_key", industryLikePattern(input.targetIndustry));
    const { data: ids } = await idsQuery;
    recipientCount = ids?.length ?? 0;
  }

  const priceVnd = recipientCount * BLAST_CHANNEL_RATES[input.channel].priceVnd;
  return { reach, recipientCount, readRatePct: READ_RATE_PCT, priceVnd };
}

export interface CreateBlastInput extends BlastEstimateInput {
  campaignName: string;
  message: string;
}

/** Gọi sau khi NTD đã bấm "Xác nhận thanh toán" ở modal (xem PaymentMethodModal) —
 * tạo cả chiến dịch Blast lẫn đơn hàng cùng lúc, "queued" nghĩa là "đã xếp hàng chờ
 * gửi sau khi Admin xác nhận thanh toán", không phải đã gửi thật (chưa tích hợp
 * cổng SMS/Zalo thật — xem BLAST_CHANNEL_RATES). */
export async function createEmployerBlast(
  employerId: string,
  input: CreateBlastInput,
  paymentMethod: PaymentMethod,
) {
  const { recipientCount, priceVnd } = await estimateBlastReach(input);
  if (recipientCount === 0) {
    return { error: "Không tìm thấy ứng viên phù hợp với bộ lọc để gửi chiến dịch." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: blast, error: blastError } = await supabase
    .from("sms_blasts")
    .insert({
      employer_id: employerId,
      campaign_name: input.campaignName,
      target_provinces: input.targetProvince ? [input.targetProvince] : null,
      target_industries: input.targetIndustry ? [input.targetIndustry] : null,
      message: input.message,
      channel: input.channel,
      recipient_count: recipientCount,
      cost_vnd: priceVnd,
      status: "queued",
    })
    .select("id")
    .single();

  if (blastError || !blast) return { error: "Không tạo được chiến dịch, thử lại sau." };

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      employer_id: employerId,
      order_type: "sms_blast",
      tier: null,
      amount: priceVnd,
      payment_method: paymentMethod,
      status: "pending",
    })
    .select("id, amount, status, created_at")
    .single();

  if (orderError || !order) return { error: "Đã tạo chiến dịch nhưng không tạo được đơn hàng." };

  return { blastId: blast.id, order, recipientCount };
}

// ───────────────────── Database ứng viên (Basic/Premium) ─────────────────────
// Quyền lợi "xem X hồ sơ ứng viên/tháng" — đếm theo ỨNG VIÊN DUY NHẤT mỗi tháng
// (xem lại hồ sơ đã xem trong tháng không trừ thêm lượt). Free (limit = 0) không
// truy cập được mục này.

function currentPeriodStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

export async function getEmployerCandidateViewUsage(employerId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("employer_candidate_views")
    .select("id", { count: "exact", head: true })
    .eq("employer_id", employerId)
    .eq("period_start", currentPeriodStart());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export interface CandidateViewResult {
  /** true nếu NTD được xem đầy đủ thông tin liên hệ (đã xem trong tháng, hoặc còn hạn mức). */
  allowed: boolean;
  viewedCount: number;
  limit: number;
  found?: boolean;
  verified?: boolean;
}

/** Ghi nhận 1 lượt xem hồ sơ ứng viên và trả về việc có được hiển thị thông tin liên hệ
 * hay không. Hết hạn mức tháng vẫn cho xem hồ sơ nhưng ẩn thông tin liên hệ. */
export async function recordCandidateProfileView(
  employerId: string,
  candidateId: string,
): Promise<CandidateViewResult> {
  const supabase = createSupabaseAdminClient();
  const periodStart = currentPeriodStart();
  const { data, error } = await supabase.rpc("record_employer_candidate_profile_view", {
    p_employer_id: employerId,
    p_candidate_id: candidateId,
    p_period_start: periodStart,
  });
  if (error) throw new Error("Không xác định được hạn mức xem hồ sơ. Đã khóa truy cập liên hệ để bảo toàn hạn mức.");
  const result = data as { allowed?: boolean; found?: boolean; verified?: boolean; viewedCount?: number; limit?: number } | null;
  if (!result || typeof result.allowed !== "boolean" || !Number.isInteger(result.viewedCount) || !Number.isInteger(result.limit)) {
    throw new Error("Phản hồi hạn mức không hợp lệ.");
  }
  return {
    allowed: result.allowed,
    viewedCount: result.viewedCount!,
    limit: result.limit!,
    ...(typeof result.found === "boolean" ? { found: result.found } : {}),
    ...(typeof result.verified === "boolean" ? { verified: result.verified } : {}),
  };
}

export interface CandidateListRow {
  id: string;
  full_name: string;
  province: string | null;
  desired_industry: string | null;
  experience_years: number | null;
  created_at: string;
}

export interface CandidateListFilters {
  province?: string;
  industry?: string;
  limit?: number;
  offset?: number;
}

/** Danh sách ứng viên trong DB cho NTD duyệt (Basic/Premium) — KHÔNG kèm thông tin liên
 * hệ, chỉ lộ ra qua recordCandidateProfileView khi NTD chủ động bấm xem hồ sơ. */
export async function listCandidatesForEmployer(
  filters: CandidateListFilters = {},
): Promise<{ candidates: CandidateListRow[]; total: number }> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("candidates")
    .select("id, full_name, province, desired_industry, experience_years, created_at", { count: "exact" })
    // Chỉ ứng viên tự điền form "Để lại thông tin" (quick_form) — ứng viên chỉ nộp
    // đơn vào 1 tin cụ thể (job_apply) xem ở mục Ứng viên đã ứng tuyển, không lộ vào
    // database chung để duyệt.
    .eq("source", "quick_form")
    .order("created_at", { ascending: false });

  if (filters.province) query = query.eq("province", filters.province);
  if (filters.industry) query = query.ilike("desired_industry_key", industryLikePattern(filters.industry));

  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { candidates: data ?? [], total: count ?? 0 };
}
