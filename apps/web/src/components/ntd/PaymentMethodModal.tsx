"use client";

import { useState } from "react";
import { PAYMENT_METHODS, PAYMENT_METHOD_META, type PaymentMethod } from "@/lib/payment-method";

/**
 * Modal chọn phương thức thanh toán + xác nhận — dùng chung cho mọi luồng mua/nâng
 * cấp trả phí (nâng gói tài khoản, chiến dịch Blast SMS/Zalo...). Chỉ xử lý bước
 * "chọn phương thức + xác nhận"; không tự vẽ màn hình thành công — gọi `onConfirmed`
 * để nơi gọi tự quyết định hiển thị gì sau khi thanh toán được ghi nhận.
 */
export function PaymentMethodModal({
  title,
  description,
  priceVnd,
  footNote = "Đơn hàng ở trạng thái chờ xác nhận — VEA sẽ kích hoạt sau khi xác minh đã nhận thanh toán.",
  onConfirm,
  onConfirmed,
  onClose,
}: {
  title: string;
  description: string;
  priceVnd: number;
  footNote?: string;
  onConfirm: (method: PaymentMethod) => Promise<{ ok: true } | { ok: false; error: string }>;
  onConfirmed: () => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await onConfirm(method);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setLoading(false);
    onConfirmed();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[460px] rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <div className="text-[15px] font-extrabold text-brand-navy">{title}</div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-[14px] text-brand-navy/60 transition hover:bg-black/10 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-5">
          <div className="text-[13px] text-brand-navy/50">{description}</div>
          <div className="my-2.5 font-mono text-[30px] font-black text-brand-orange">
            {priceVnd.toLocaleString("vi-VN")}đ
          </div>

          <div className="mb-2 text-[12px] text-brand-navy/45">Phương thức thanh toán:</div>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                disabled={loading}
                className={`rounded-lg border-[1.5px] py-2.5 text-center text-[12px] font-semibold transition disabled:opacity-60 ${
                  method === m
                    ? "border-brand-orange bg-brand-orange-light text-brand-orange"
                    : "border-black/10 text-brand-navy/60 hover:border-brand-orange/40"
                }`}
              >
                <div className="text-[16px]">{PAYMENT_METHOD_META[m].icon}</div>
                {PAYMENT_METHOD_META[m].label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-brand-orange to-orange-600 py-3 text-[14px] font-bold text-white transition hover:brightness-105 disabled:opacity-60"
          >
            {loading ? "Đang xử lý..." : "Xác nhận thanh toán →"}
          </button>
          <p className="mt-2.5 text-center text-[11px] text-brand-navy/35">🔒 {footNote}</p>
        </div>
      </div>
    </div>
  );
}
