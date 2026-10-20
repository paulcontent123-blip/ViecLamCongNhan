"use client";

import { useEffect, useState } from "react";
import type { OrderPaymentView } from "@/lib/payment";
import {
  PAYMENT_METHOD_META,
  PAYMENT_METHODS,
  SELECTABLE_PAYMENT_METHODS,
  type PaymentMethod,
  type SelectablePaymentMethod,
} from "@/lib/payment-method";
import { PaymentDetail } from "@/components/ntd/PaymentDetail";

/**
 * Modal thanh toán dùng chung cho mọi luồng trả phí (nâng gói tài khoản, gói Chiến
 * dịch, Blast SMS/Zalo). Hai bước, giống nhau ở mọi luồng:
 *   1. Chọn phương thức (VietQR / MoMo) rồi xác nhận -> `onConfirm` tạo đơn.
 *   2. Hiện mã QR + thông tin nhận tiền + nút "Tôi đã thanh toán" (PaymentDetail).
 * Luồng nào chưa trả về `payment` (đơn không gắn kênh nhận tiền) thì dừng ở màn hình
 * báo đã ghi nhận như trước, không chặn NTD.
 */
export function PaymentMethodModal({
  title,
  description,
  priceVnd,
  footNote = "Đơn hàng ở trạng thái chờ xác nhận ‑ VEA sẽ kích hoạt sau khi xác minh đã nhận thanh toán.",
  onConfirm,
  onConfirmed,
  onClose,
}: {
  title: string;
  description: string;
  priceVnd: number;
  footNote?: string;
  onConfirm: (
    method: PaymentMethod,
  ) => Promise<{ ok: true; payment?: OrderPaymentView } | { ok: false; error: string }>;
  onConfirmed: () => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<SelectablePaymentMethod>("bank_transfer");
  const [available, setAvailable] = useState<Record<string, boolean>>({ bank_transfer: true, momo: true });
  const [payment, setPayment] = useState<OrderPaymentView | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phương thức nào Admin đã bật kênh nhận tiền: chưa bật thì hiện "Sắp có" thay vì
  // để NTD tạo đơn rồi không biết chuyển tiền đi đâu.
  useEffect(() => {
    let alive = true;
    fetch("/api/employer/payment-methods")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setAvailable({ bank_transfer: !!data.bank_transfer, momo: !!data.momo });
        if (!data.bank_transfer && data.momo) setMethod("momo");
      })
      .catch(() => {
        /* không đọc được: giữ nguyên lựa chọn mặc định, lỗi thật sẽ hiện khi tạo đơn */
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const result = await onConfirm(method);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.payment) setPayment(result.payment);
    else setDone(true);
    onConfirmed();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div
        className="my-auto w-full max-w-[460px] rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <div className="text-[15px] font-extrabold text-brand-navy">
            {payment ? "Thông tin thanh toán" : title}
          </div>
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
          {payment ? (
            <PaymentDetail payment={payment} onClose={onClose} />
          ) : done ? (
            <div className="text-center">
              <div className="text-[40px]">✅</div>
              <div className="mt-2 text-[16px] font-extrabold text-brand-navy">Đã ghi nhận đơn hàng!</div>
              <p className="mx-auto mt-1.5 max-w-xs text-[13px] text-brand-navy/55">{footNote}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 w-full rounded-lg bg-brand-orange py-2.5 text-[13px] font-bold text-white transition hover:brightness-105"
              >
                Đóng
              </button>
            </div>
          ) : (
            <>
              <div className="text-[13px] text-brand-navy/50">{description}</div>
              <div className="my-2.5 font-mono text-[30px] font-black text-brand-orange">
                {priceVnd.toLocaleString("vi-VN")}đ
              </div>

              <div className="mb-2 text-[12px] text-brand-navy/45">Phương thức thanh toán:</div>
              <div className="mb-4 space-y-2">
                {PAYMENT_METHODS.map((m) => {
                  const meta = PAYMENT_METHOD_META[m];
                  const selectable = (SELECTABLE_PAYMENT_METHODS as readonly string[]).includes(m);
                  const ready = selectable && available[m] !== false;
                  const active = ready && method === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={!ready || loading}
                      onClick={() => ready && setMethod(m as SelectablePaymentMethod)}
                      className={`flex w-full items-start gap-3 rounded-xl border-[1.5px] px-3 py-3 text-left transition disabled:opacity-50 ${
                        active
                          ? "border-brand-orange bg-brand-orange-light"
                          : "border-black/10 hover:border-brand-orange/40"
                      }`}
                    >
                      <span className="text-[18px] leading-none">{meta.icon}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-[13px] font-bold text-brand-navy">
                          {meta.label}
                          {!ready && (
                            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold text-brand-navy/45">
                              Sắp có
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] text-brand-navy/45">{meta.description}</span>
                      </span>
                    </button>
                  );
                })}
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
                {loading ? "Đang tạo đơn..." : "Tạo đơn & lấy mã QR →"}
              </button>
              <p className="mt-2.5 text-center text-[11px] text-brand-navy/35">🔒 {footNote}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
