"use client";

import { useEffect, useState } from "react";
import type { PublicServiceInquiryKind } from "@/lib/service-inquiry";

type SubmitState = "idle" | "loading" | "success";

export function ServiceInquiryModal({
  serviceName,
  onClose,
  inquiryType = "service-package",
}: {
  serviceName: string;
  onClose: () => void;
  inquiryType?: PublicServiceInquiryKind;
}) {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);
  const isAdvertising = inquiryType === "advertising";
  const isAdvertisingPricing = inquiryType === "advertising-pricing";
  const isAdvertisingRequest = isAdvertising || isAdvertisingPricing;
  const isServicePartner = inquiryType === "service-partner";
  const dialogId = isAdvertisingRequest
    ? "advertising-inquiry-title"
    : isServicePartner
      ? "service-partner-inquiry-title"
      : "service-inquiry-title";

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("loading");
    setError(null);

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/service-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquiryType,
          serviceName,
          companyName: form.get("companyName"),
          phone: form.get("phone"),
          email: form.get("email"),
          request: form.get("request"),
          kcnTarget: form.get("kcnTarget") ?? "",
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setSubmitState("idle");
        setError(data?.error ?? "Không gửi được yêu cầu, vui lòng thử lại sau.");
        return;
      }

      setSubmitState("success");
      formElement.reset();
    } catch {
      setSubmitState("idle");
      setError("Không kết nối được máy chủ, vui lòng thử lại sau.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-navy/55 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogId}
        className="max-h-[calc(100vh-2rem)] w-full max-w-[540px] overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/5 px-5 py-4 sm:px-6">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">
              {isAdvertisingRequest ? "Đăng ký quảng cáo" : isServicePartner ? "Đề xuất hợp tác" : "Đăng ký tư vấn"}
            </div>
            <h2 id={dialogId} className="mt-1 text-[18px] font-extrabold text-brand-navy">
              {isAdvertisingRequest ? "Đặt quảng cáo" : isServicePartner ? "Gửi đề xuất hợp tác" : "Nhận tư vấn dịch vụ"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng form tư vấn"
            className="rounded-lg px-2 py-1 text-xl leading-none text-brand-navy/40 transition hover:bg-black/5 hover:text-brand-navy"
          >
            ×
          </button>
        </div>

        {submitState === "success" ? (
          <div className="p-6 text-center sm:p-8">
            <div className="text-[34px]">✅</div>
            <h3 className="mt-2 text-[16px] font-extrabold text-emerald-800">
              {isAdvertisingRequest ? "Đã nhận yêu cầu quảng cáo" : isServicePartner ? "Đã nhận đề xuất hợp tác" : "Đã nhận yêu cầu tư vấn"}
            </h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-emerald-700">
              Cảm ơn bạn đã để lại thông tin. Bộ phận kinh doanh sẽ liên hệ trong 2 giờ làm việc.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-xl bg-brand-orange px-6 py-2.5 text-[13px] font-bold text-white transition hover:brightness-105"
            >
              Đóng
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6">
            <div className="rounded-xl border border-brand-orange/20 bg-brand-orange-light px-3.5 py-3 text-[12.5px] text-brand-navy/70">
              <div className="font-semibold text-brand-navy/55">
                {isAdvertisingRequest ? "Gói quảng cáo bạn quan tâm" : isServicePartner ? "Đối tác bạn quan tâm" : "Dịch vụ bạn quan tâm"}
              </div>
              <div className="mt-0.5 font-extrabold text-brand-orange">{serviceName}</div>
            </div>

            <p className="mt-3 text-[12.5px] leading-relaxed text-brand-navy/55">
              Để lại thông tin, bộ phận kinh doanh sẽ liên hệ trong 2 giờ làm việc.
            </p>

            <label className="mt-4 block text-[12px] font-semibold text-brand-navy/60">
              Tên công ty / Nhà tuyển dụng *
              <input
                name="companyName"
                required
                minLength={2}
                placeholder="Công ty TNHH ABC"
                className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none transition focus:border-brand-orange"
              />
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px] font-semibold text-brand-navy/60">
                Số điện thoại *
                <input
                  name="phone"
                  type="tel"
                  required
                  minLength={9}
                  placeholder="0767 977 415"
                  className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none transition focus:border-brand-orange"
                />
              </label>
              <label className="block text-[12px] font-semibold text-brand-navy/60">
                Email *
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="contact@congty.vn"
                  className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none transition focus:border-brand-orange"
                />
              </label>
            </div>

            {isAdvertising && (
              <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
                KCN / Tỉnh bạn muốn quảng cáo *
                <input
                  name="kcnTarget"
                  required
                  maxLength={200}
                  placeholder="KCN VSIP 1 / Bình Dương"
                  className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none transition focus:border-brand-orange"
                />
              </label>
            )}

            <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
              Yêu cầu của bạn *
              <textarea
                name="request"
                required
                minLength={10}
                rows={4}
                placeholder="Mô tả nhu cầu, số lượng nhân sự hoặc nội dung cần tư vấn..."
                className="mt-1.5 w-full resize-y rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none transition focus:border-brand-orange"
              />
            </label>

            {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700">{error}</div>}

            <button
              type="submit"
              disabled={submitState === "loading"}
              className="mt-4 w-full rounded-xl bg-gradient-to-br from-brand-orange to-[#e06428] py-3 text-[14px] font-extrabold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitState === "loading" ? "Đang gửi..." : isAdvertisingRequest ? "Đặt quảng cáo" : "Đặt tư vấn"}
            </button>
            <div className="mt-3 text-center text-[12px] text-brand-navy/50">
              Bạn có thể liên hệ số hotline <a href="tel:0767977415" className="font-bold text-brand-orange">0767977415</a> để được tư vấn ngay
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
