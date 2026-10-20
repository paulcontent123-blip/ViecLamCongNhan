"use client";

import { useState } from "react";
import { ServiceInquiryModal } from "@/components/dichvu/ServiceInquiryModal";
import type { ServicePackageCardRow } from "@/types/db";

const ACCENT_BORDER: Record<ServicePackageCardRow["accent"], string> = {
  orange: "border-brand-orange/20",
  green: "border-emerald-200",
  amber: "border-amber-200",
  red: "border-red-200",
  full: "border-brand-orange",
};

function ServiceCard({ service, onSelect }: { service: ServicePackageCardRow; onSelect: () => void }) {
  const isFull = service.accent === "full";

  return (
    <article
      className={`flex flex-col rounded-2xl border p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-7 ${
        isFull
          ? "border-brand-orange bg-gradient-to-br from-brand-orange to-brand-orange-2 text-white"
          : `bg-white ${ACCENT_BORDER[service.accent]}`
      }`}
    >
      <div className="text-[30px] leading-none">{service.icon}</div>
      <h2 className={`mt-5 text-[17px] font-extrabold ${isFull ? "text-white" : "text-brand-navy"}`}>
        {service.title}
      </h2>
      <p className={`mt-2 text-[13.5px] leading-relaxed ${isFull ? "text-white/75" : "text-brand-navy/55"}`}>
        {service.description}
      </p>
      <ul className="mt-4 flex flex-1 flex-col gap-2">
        {service.features.map((feature) => (
          <li
            key={feature}
            className={`flex gap-2 text-[13px] leading-relaxed ${isFull ? "text-white/85" : "text-brand-navy/60"}`}
          >
            <span className={`shrink-0 font-extrabold ${isFull ? "text-[#ffd080]" : "text-emerald-600"}`}>✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className={`mt-5 text-[18px] font-extrabold ${isFull ? "text-[#ffd080]" : "text-brand-orange"}`}>
        {service.price}
      </div>
      <button
        type="button"
        onClick={onSelect}
        className={`mt-4 self-start rounded-lg px-5 py-2.5 text-[13.5px] font-bold transition hover:-translate-y-0.5 ${
          isFull
            ? "bg-white text-brand-orange shadow-sm hover:shadow-md"
            : service.accent === "orange"
              ? "bg-brand-orange text-white shadow-sm hover:brightness-105"
              : "border border-brand-orange/25 bg-brand-orange-light text-brand-orange hover:bg-brand-orange hover:text-white"
        }`}
      >
        {service.cta_label}
      </button>
    </article>
  );
}

export function ServiceInquiryPage({ cards }: { cards: ServicePackageCardRow[] }) {
  const [selectedService, setSelectedService] = useState<string | null>(null);

  return (
    <div className="bg-[#f6f7f9] px-4 py-16 sm:px-8 sm:py-20 lg:px-[52px]">
      <div className="mx-auto max-w-6xl">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">Dịch vụ trọn gói</div>
        <h1 className="mt-3 max-w-2xl text-[34px] font-extrabold leading-tight text-brand-navy sm:text-[44px]">
          Một đầu mối ‑
          <br />
          <em className="text-brand-orange not-italic">toàn bộ nhân sự công nhân</em>
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-brand-navy/60">
          Từ tuyển dụng đến quản lý hồ sơ, thuế, BHXH và tư vấn pháp lý lao động ‑ ViecLamCongNhan.com phối hợp với
          VEA Law và DichVuThue.net để xử lý trọn gói.
        </p>

        {cards.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
            Nội dung dịch vụ trọn gói đang được cập nhật.
          </div>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {cards.map((service) => (
              <ServiceCard key={service.id} service={service} onSelect={() => setSelectedService(service.title)} />
            ))}
          </div>
        )}
      </div>

      {selectedService && <ServiceInquiryModal serviceName={selectedService} onClose={() => setSelectedService(null)} />}
    </div>
  );
}
