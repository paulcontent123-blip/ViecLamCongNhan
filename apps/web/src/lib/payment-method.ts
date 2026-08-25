// Khớp constraint orders_payment_method_check ở supabase/migrations/20260817120009_create_orders.sql.
export const PAYMENT_METHODS = ["bank_transfer", "momo", "vnpay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string; icon: string }> = {
  bank_transfer: { label: "Chuyển khoản", icon: "🏦" },
  momo: { label: "MoMo", icon: "📱" },
  vnpay: { label: "VNPay", icon: "💳" },
};
