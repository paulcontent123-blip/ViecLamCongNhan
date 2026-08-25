// Theme banner trang Chiến dịch — NTD tự chọn khi chỉnh sửa chiến dịch của mình.
// Không phụ thuộc server-only nên dùng được cả ở Client Component (form chọn theme).
export const CAMPAIGN_THEMES = {
  orange: { label: "Cam", swatchClass: "bg-orange-400", gradientClass: "from-orange-300 to-orange-500" },
  blue: { label: "Xanh dương", swatchClass: "bg-blue-400", gradientClass: "from-blue-300 to-blue-500" },
  green: { label: "Xanh lá", swatchClass: "bg-emerald-400", gradientClass: "from-emerald-300 to-emerald-500" },
  purple: { label: "Tím", swatchClass: "bg-violet-400", gradientClass: "from-violet-300 to-violet-500" },
  pink: { label: "Hồng", swatchClass: "bg-pink-400", gradientClass: "from-pink-300 to-pink-500" },
} as const;

export type CampaignTheme = keyof typeof CAMPAIGN_THEMES;

export function isCampaignTheme(value: string): value is CampaignTheme {
  return value in CAMPAIGN_THEMES;
}
