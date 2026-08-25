// Tier lưu trên jobs.tier — khớp migration supabase/migrations/20260817120005_create_jobs.sql
// + 20260819090001_employer_account_tiers.sql. 'free'/'basic'/'premium' được GÁN TỰ ĐỘNG
// theo gói thuê bao tài khoản của NTD tại thời điểm đăng tin (xem account-tiers.ts,
// createEmployerJob) — NTD không chọn/mua riêng theo từng tin nữa. 'campaign' là ngoại lệ
// duy nhất: vẫn là gói mua thêm riêng cho 1 tin cụ thể (xem JOB_ADDONS bên dưới).
export const JOB_TIERS = ["free", "basic", "premium", "campaign"] as const;
export type JobTier = (typeof JOB_TIERS)[number];

export function isJobTier(value: string): value is JobTier {
  return (JOB_TIERS as readonly string[]).includes(value);
}

// Gói mua thêm riêng cho từng tin — độc lập với thuê bao tài khoản Free/Basic/Premium.
export const JOB_ADDONS = {
  campaign: { label: "Chiến dịch", priceVnd: 1_500_000, durationDays: 60, orderType: "job_post" },
} as const;

export type JobAddon = keyof typeof JOB_ADDONS;

export function isJobAddon(value: string): value is JobAddon {
  return value in JOB_ADDONS;
}

// Trong 1.500.000đ giá gói Chiến dịch, 1.000.000đ được dùng làm hạn mức tự động gửi
// tin nhắn Zalo cho ứng viên cùng ngành nghề + tỉnh thành ngay khi mua gói (xem
// runCampaignAutoBlast ở employer.ts) — 500.000đ còn lại là phí hiển thị/banner.
export const CAMPAIGN_BLAST_BUDGET_VND = 1_000_000;
