// Khớp constraint orders_payment_method_check ở supabase/migrations/20260817120009_create_orders.sql.
export const PAYMENT_METHODS = ["bank_transfer", "momo", "vnpay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string; icon: string; description: string }> = {
  bank_transfer: {
    label: "VietQR / Chuyển khoản",
    icon: "🏦",
    description: "Quét mã VietQR hoặc chuyển khoản thủ công, ghi đúng nội dung chuyển khoản.",
  },
  momo: {
    label: "Ví MoMo",
    icon: "🟣",
    description: "Quét mã QR ví MoMo của VEA, ghi lời nhắn đúng mã đơn hàng.",
  },
  vnpay: {
    label: "VNPay",
    icon: "💳",
    description: "Cổng thanh toán thẻ/QR VNPay.",
  },
};

/** Phương thức NTD chọn được ở màn hình thanh toán. VNPay chờ hợp đồng cổng nên hiện "Sắp có". */
export const SELECTABLE_PAYMENT_METHODS = ["bank_transfer", "momo"] as const satisfies readonly PaymentMethod[];
export type SelectablePaymentMethod = (typeof SELECTABLE_PAYMENT_METHODS)[number];

export function isSelectablePaymentMethod(value: string): value is SelectablePaymentMethod {
  return (SELECTABLE_PAYMENT_METHODS as readonly string[]).includes(value);
}
