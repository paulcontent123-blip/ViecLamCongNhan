// Quyền lợi thuê bao tài khoản NTD (Free/Basic/Premium) ‑ nguồn sự thật duy nhất,
// khớp migration supabase/migrations/20260819090001_employer_account_tiers.sql.
// Khác với JOB_ADDONS ở packages.ts (mua thêm riêng cho 1 tin, VD: Chiến dịch) ‑
// các quyền lợi ở đây áp dụng cho TOÀN BỘ tài khoản trong suốt chu kỳ thuê bao.
export const ACCOUNT_TIERS = {
  free: {
    label: "Free",
    priceVnd: 0,
    billingCycleDays: null,
    dailyPostLimit: 1,
    jobDurationDays: 14,
    showInSearch: false,
    showOnHomepage: false,
    candidateViewLimit: 0,
    matchingSupport: false,
  },
  basic: {
    label: "Basic",
    priceVnd: 399_000,
    billingCycleDays: 30,
    dailyPostLimit: 3,
    jobDurationDays: 30,
    showInSearch: true,
    showOnHomepage: false,
    candidateViewLimit: 60,
    matchingSupport: false,
  },
  premium: {
    label: "Premium",
    priceVnd: 899_000,
    billingCycleDays: 30,
    dailyPostLimit: 10,
    jobDurationDays: 30,
    showInSearch: true,
    showOnHomepage: true,
    candidateViewLimit: 300,
    matchingSupport: true,
  },
} as const;

export type AccountTier = keyof typeof ACCOUNT_TIERS;

export function isAccountTier(value: string): value is AccountTier {
  return value in ACCOUNT_TIERS;
}

export const PAID_ACCOUNT_TIERS = ["basic", "premium"] as const;
export type PaidAccountTier = (typeof PAID_ACCOUNT_TIERS)[number];

export function isPaidAccountTier(value: string): value is PaidAccountTier {
  return (PAID_ACCOUNT_TIERS as readonly string[]).includes(value);
}
