// Tách riêng khỏi lib/admin.ts (có "server-only") vì nhãn này cần dùng cả ở client
// component (OrderStatusActions.tsx) lẫn server component (admin/don-hang/page.tsx).
export const ORDER_TYPE_LABEL: Record<string, string> = {
  job_post: "Mua thêm (Chiến dịch)",
  account_subscription: "Thuê bao tài khoản",
  sms_blast: "Blast SMS/Zalo",
  rpo_service: "Dịch vụ RPO",
  banner: "Banner quảng cáo",
};
