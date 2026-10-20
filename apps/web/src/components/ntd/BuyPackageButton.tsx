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
      return { ok: true as const, payment: data.payment };
    } catch {
      return { ok: false as const, error: "Không kết nối được máy chủ." };
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`w-full rounded-lg py-2 text-[12px] font-bold transition ${
          highlight
            ? "bg-brand-orange text-white hover:brightness-105"
            : "border border-brand-orange/30 bg-brand-orange-light text-brand-orange hover:bg-brand-orange/15"
        }`}
      >
        {highlight ? "Mua ngay ★" : "Mua ngay"}
      </button>

      {modalOpen && (
        <PaymentMethodModal
          title="Nâng cấp gói tài khoản"
          description={`Gói ${label} ‑ thuê bao theo tháng`}
          priceVnd={priceVnd}
          footNote={`Gói ${label} được kích hoạt ngay sau khi VEA xác minh đã nhận thanh toán (thường trong vài giờ làm việc).`}
          onConfirm={handleConfirm}
          onConfirmed={() => router.refresh()}
          onClose={() => {
            setModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
