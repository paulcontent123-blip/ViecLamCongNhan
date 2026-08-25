"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PaymentMethod } from "@/lib/payment-method";
import { PaymentMethodModal } from "@/components/ntd/PaymentMethodModal";

export function BuyPackageButton({
  tier,
  label,
  priceVnd,
  highlight,
  verified = true,
}: {
  tier: "basic" | "premium" | "campaign";
  label: string;
  priceVnd: number;
  highlight?: boolean;
  verified?: boolean;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!verified) {
    return (
      <button
        type="button"
        disabled
        title="Cần Admin xác minh tài khoản trước khi mua gói"
        className="w-full cursor-not-allowed rounded-lg border border-black/10 bg-black/5 py-2 text-[12px] font-bold text-brand-navy/35"
      >
        🔒 Chờ xác minh
      </button>
    );
  }

  function openModal() {
    setSuccess(false);
    setModalOpen(true);
  }

  async function handleConfirm(method: PaymentMethod) {
    try {
      const res = await fetch("/api/employer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, paymentMethod: method }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false as const, error: data.error ?? "Không tạo được đơn hàng." };
      router.refresh();
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "Không kết nối được máy chủ." };
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={`w-full rounded-lg py-2 text-[12px] font-bold transition ${
          highlight
            ? "bg-brand-orange text-white hover:brightness-105"
            : "border border-brand-orange/30 bg-brand-orange-light text-brand-orange hover:bg-brand-orange/15"
        }`}
      >
        {highlight ? "Mua ngay ★" : "Mua ngay"}
      </button>

      {modalOpen && !success && (
        <PaymentMethodModal
          title="Nâng cấp gói tài khoản"
          description={`Gói ${label} — thuê bao theo tháng`}
          priceVnd={priceVnd}
          onConfirm={handleConfirm}
          onConfirmed={() => setSuccess(true)}
          onClose={() => setModalOpen(false)}
        />
      )}

      {modalOpen && success && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[40px]">✅</div>
            <div className="mt-2 text-[16px] font-extrabold text-brand-navy">Thanh toán thành công!</div>
            <p className="mx-auto mt-1.5 max-w-xs text-[13px] text-brand-navy/55">
              Đơn hàng đang chờ Admin xác nhận — gói {label} sẽ được kích hoạt ngay sau khi xác nhận (thường
              trong vài giờ làm việc).
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="mt-5 w-full rounded-lg bg-brand-orange py-2.5 text-[13px] font-bold text-white transition hover:brightness-105"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </>
  );
}
