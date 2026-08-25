"use client";

import { useState } from "react";
import { ServiceInquiryModal } from "@/components/dichvu/ServiceInquiryModal";
import type { AdvertisingPricingCardRow, KcnAdCardRow, ServicePartnerCardRow } from "@/types/db";

type AdvertisingTab = "kcn" | "partner" | "price";

const ICON_BG_CLASS: Record<string, string> = {
  emerald: "bg-emerald-50",
  orange: "bg-orange-50",
  purple: "bg-violet-50",
  amber: "bg-amber-50",
  indigo: "bg-indigo-50",
};

const TAG_CLASS: Record<string, string> = {
  ins: "border-emerald-200 bg-emerald-50 text-emerald-700",
  dig: "border-orange-200 bg-orange-50 text-orange-700",
};

const PARTNER_ICON_BG_CLASS: Record<string, string> = {
  emerald: "bg-emerald-50",
  orange: "bg-orange-50",
  purple: "bg-violet-50",
  amber: "bg-amber-50",
  indigo: "bg-indigo-50",
};

const PARTNER_TAG_CLASS: Record<string, string> = {
  ins: "border-emerald-200 bg-emerald-50 text-emerald-700",
  fin: "border-orange-200 bg-orange-50 text-orange-700",
  dig: "border-violet-200 bg-violet-50 text-violet-700",
  pension: "border-amber-200 bg-amber-50 text-amber-700",
};

type PartnerFilter = "all" | "insurance" | "finance" | "wallet" | "pension";

const PARTNER_FILTERS: { key: PartnerFilter; label: string; icon: string; tags: string[] }[] = [
  { key: "all", label: "Tất cả", icon: "", tags: [] },
  { key: "insurance", label: "Bảo hiểm", icon: "🛡", tags: ["Bảo hiểm"] },
  { key: "finance", label: "Vay tiêu dùng", icon: "💵", tags: ["Vay tiêu dùng"] },
  { key: "wallet", label: "Ví điện tử", icon: "📱", tags: ["Ví điện tử"] },
  { key: "pension", label: "BHXH & Hưu trí", icon: "🏛", tags: ["BHXH Nhà nước", "Đầu tư hưu trí"] },
];

function KcnAdCard({ card, onSelect }: { card: KcnAdCardRow; onSelect: () => void }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[#d9e0ee] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3 border-b border-[#d9e0ee] px-5 py-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[26px] ${ICON_BG_CLASS[card.icon_bg] ?? "bg-brand-orange-light"}`}>
          {card.icon}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-[16px] font-extrabold text-brand-navy">{card.title}</h2>
          <p className="mt-0.5 text-[11.5px] font-medium uppercase tracking-wide text-brand-navy/55">{card.category}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-5 py-4">
        <span className={`self-start rounded border px-2 py-1 text-[10.5px] font-semibold ${TAG_CLASS[card.tag_tone] ?? TAG_CLASS.ins}`}>
          {card.tag}
        </span>
        <p className="mt-3 text-[13.5px] leading-relaxed text-brand-navy/65">{card.description}</p>
        <ul className="mt-3 flex flex-1 flex-col gap-2">
          {card.package_lines.map((line) => (
            <li key={line} className="flex gap-2 text-[13px] leading-relaxed text-brand-navy/65">
              <span className="shrink-0 font-extrabold text-brand-orange">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onSelect}
          className="mt-5 self-start text-[13.5px] font-extrabold text-brand-orange transition hover:text-brand-orange-2"
        >
          {card.cta_label} →
        </button>
      </div>
    </article>
  );
}

function ServicePartnerCard({ card, onSelect }: { card: ServicePartnerCardRow; onSelect: () => void }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[#d9e0ee] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-orange hover:shadow-md">
      <div className="flex items-center gap-3 border-b border-[#d9e0ee] px-[18px] py-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[22px] ${PARTNER_ICON_BG_CLASS[card.icon_bg] ?? "bg-brand-orange-light"}`}>
          {card.icon}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-[14px] font-extrabold text-brand-navy">{card.title}</h2>
          <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] text-brand-navy/55">{card.category}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-[18px] py-3.5">
        <span className={`self-start rounded border px-2 py-0.5 text-[9.5px] font-bold ${PARTNER_TAG_CLASS[card.tag_tone] ?? "border-black/10 bg-black/[0.03] text-brand-navy/60"}`}>
          {card.tag}
        </span>
        <p className="mt-1.5 text-[12.5px] leading-[1.65] text-brand-navy/60">{card.description}</p>
        <ul className="mt-2.5 flex flex-1 flex-col gap-1.5">
          {card.package_lines.map((line) => (
            <li key={line} className="flex gap-1.5 text-[12px] leading-relaxed text-brand-navy/60">
              <span className="shrink-0 font-extrabold text-brand-orange">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onSelect} className="mt-3 flex items-center gap-1.5 self-start text-[12px] font-bold text-brand-orange transition hover:text-brand-orange-2">
          {card.cta_label} →
        </button>
      </div>
    </article>
  );
}

function ServicePartnerDetailModal({
  partner,
  onClose,
  onRequest,
}: {
  partner: ServicePartnerCardRow;
  onClose: () => void;
  onRequest: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-brand-navy/55 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="service-partner-detail-title" className="max-h-[calc(100vh-2rem)] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-black/5 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[22px] ${PARTNER_ICON_BG_CLASS[partner.icon_bg] ?? "bg-brand-orange-light"}`}>
              {partner.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-brand-orange">Chi tiết đối tác</div>
              <h2 id="service-partner-detail-title" className="mt-1 text-[18px] font-extrabold text-brand-navy">{partner.title}</h2>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-navy/50">{partner.category}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng chi tiết đối tác" className="rounded-lg px-2 py-1 text-xl leading-none text-brand-navy/40 transition hover:bg-black/5 hover:text-brand-navy">×</button>
        </div>

        <div className="p-5 sm:p-6">
          <span className={`inline-block rounded border px-2 py-0.5 text-[9.5px] font-bold ${PARTNER_TAG_CLASS[partner.tag_tone] ?? "border-black/10 bg-black/[0.03] text-brand-navy/60"}`}>
            {partner.tag}
          </span>
          <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-brand-navy/65">{partner.description}</p>
          <div className="mt-5 rounded-xl border border-brand-orange/15 bg-brand-orange-light/40 p-4">
            <div className="text-[12px] font-bold uppercase tracking-wide text-brand-navy/50">Thông tin gói / quyền lợi</div>
            <ul className="mt-2.5 flex flex-col gap-2">
              {partner.package_lines.map((line) => (
                <li key={line} className="flex gap-2 text-[13px] leading-relaxed text-brand-navy/65">
                  <span className="shrink-0 font-extrabold text-brand-orange">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <button type="button" onClick={onRequest} className="mt-5 w-full rounded-xl bg-brand-orange py-3 text-[14px] font-extrabold text-white shadow-sm transition hover:brightness-105">
            Gửi đề xuất hợp tác
          </button>
          <div className="mt-3 text-center text-[12px] text-brand-navy/50">Bộ phận kinh doanh sẽ liên hệ trong 2 giờ làm việc.</div>
        </div>
      </div>
    </div>
  );
}

function AdvertisingPricingTable({
  cards,
  onSelect,
}: {
  cards: AdvertisingPricingCardRow[];
  onSelect: (card: AdvertisingPricingCardRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
          <thead className="bg-brand-navy text-white">
            <tr>
              <th className="px-4 py-3.5 font-bold">Định dạng</th>
              <th className="px-4 py-3.5 font-bold">Vị trí</th>
              <th className="px-4 py-3.5 font-bold">Giá</th>
              <th className="px-4 py-3.5 font-bold">Đơn vị</th>
              <th className="px-4 py-3.5 text-right font-bold" aria-label="Đặt quảng cáo" />
            </tr>
          </thead>
          <tbody>
            {cards.map((card, index) => (
              <tr key={card.id} className={index % 2 === 0 ? "bg-white" : "bg-[#eef1f8]"}>
                <td className="border-b border-[#d9e0ee] px-4 py-3.5 font-bold text-brand-navy">{card.format}</td>
                <td className="border-b border-[#d9e0ee] px-4 py-3.5 text-brand-navy/65">{card.placement}</td>
                <td className="border-b border-[#d9e0ee] px-4 py-3.5 text-[15px] font-extrabold text-brand-orange">{card.price}</td>
                <td className="border-b border-[#d9e0ee] px-4 py-3.5 text-brand-navy/65">{card.unit}</td>
                <td className="border-b border-[#d9e0ee] px-4 py-3.5 text-right">
                  <button
                    type="button"
                    onClick={() => onSelect(card)}
                    className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-[11.5px] font-extrabold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    {card.cta_label}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function KcnAdvertisingPage({
  cards,
  partnerCards,
  pricingCards,
  audienceCount,
}: {
  cards: KcnAdCardRow[];
  partnerCards: ServicePartnerCardRow[];
  pricingCards: AdvertisingPricingCardRow[];
  audienceCount: number;
}) {
  const [activeTab, setActiveTab] = useState<AdvertisingTab>("kcn");
  const [selectedCard, setSelectedCard] = useState<KcnAdCardRow | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<ServicePartnerCardRow | null>(null);
  const [selectedPartnerInquiry, setSelectedPartnerInquiry] = useState<string | null>(null);
  const [selectedPricing, setSelectedPricing] = useState<AdvertisingPricingCardRow | null>(null);
  const [partnerFilter, setPartnerFilter] = useState<PartnerFilter>("all");

  const visiblePartnerCards = partnerFilter === "all"
    ? partnerCards
    : partnerCards.filter((card) => {
        const filter = PARTNER_FILTERS.find((item) => item.key === partnerFilter);
        return filter?.tags.includes(card.tag) ?? false;
      });

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#f6f7f9] px-4 py-14 sm:px-8 sm:py-16 lg:px-[52px]">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">
          <span className="inline-block h-px w-4 bg-brand-orange" />
          Hợp tác &amp; Đối tác
        </div>
        <h1 className="mt-3 max-w-3xl text-[34px] font-extrabold leading-tight text-brand-navy sm:text-[44px]">
          Quảng cáo &amp; <em className="not-italic text-brand-orange">Đối tác chiến lược</em>
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-brand-navy/65">
          Target đúng {audienceCount.toLocaleString("vi-VN")} công nhân đang tìm việc. CPM thấp, conversion cao hơn Facebook Ads vì đây là tệp đang có nhu cầu thực tế. Ngoài ra, các đối tác dịch vụ tài chính, bảo hiểm có thể tiếp cận tệp lao động phổ thông chất lượng.
        </p>

        <div className="mt-9 flex flex-wrap gap-1 border-b border-[#d9e0ee]" role="tablist" aria-label="Danh mục quảng cáo và hợp tác">
          {[
            { key: "kcn" as const, label: "📍 Quảng cáo theo KCN" },
            { key: "partner" as const, label: "🤝 Đối tác dịch vụ" },
            { key: "price" as const, label: "💰 Bảng giá quảng cáo" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-3 py-3 text-[13px] font-bold transition sm:px-4 ${
                activeTab === tab.key
                  ? "border-brand-orange text-brand-orange"
                  : "border-transparent text-brand-navy/55 hover:text-brand-orange"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "kcn" ? (
          <section className="pt-6" role="tabpanel">
            <p className="mb-5 text-[14px] leading-relaxed text-brand-navy/60">
              Quảng cáo banner, card nhà trọ, dịch vụ xung quanh KCN — hiển thị đúng trang KCN và tin tuyển dụng tại khu vực bạn muốn target.
            </p>
            {cards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
                Nội dung quảng cáo theo KCN đang được cập nhật.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                {cards.map((card) => (
                  <KcnAdCard key={card.id} card={card} onSelect={() => setSelectedCard(card)} />
                ))}
              </div>
            )}
          </section>
        ) : activeTab === "partner" ? (
          <section className="pt-6" role="tabpanel">
            <p className="mb-4 text-[14px] leading-relaxed text-brand-navy/60">
              Các đơn vị đang cung cấp dịch vụ tài chính, bảo hiểm, tích lũy dành cho công nhân — phù hợp để tiếp cận tệp lao động phổ thông qua ViecLamCongNhan.
            </p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {PARTNER_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setPartnerFilter(filter.key)}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-bold transition ${
                    partnerFilter === filter.key
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-white text-brand-navy/55 hover:bg-black/[0.03] hover:text-brand-orange"
                  }`}
                >
                  {filter.icon && `${filter.icon} `}{filter.label}
                </button>
              ))}
            </div>
            {visiblePartnerCards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
                Nội dung đối tác dịch vụ đang được cập nhật.
              </div>
            ) : (
              <div className="grid gap-3.5 lg:grid-cols-3">
                {visiblePartnerCards.map((partner) => (
                  <ServicePartnerCard key={partner.id} card={partner} onSelect={() => setSelectedPartner(partner)} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="pt-6" role="tabpanel">
            <p className="mb-5 text-[14px] leading-relaxed text-brand-navy/60">
              Chọn định dạng quảng cáo phù hợp để xem thông tin và gửi yêu cầu tư vấn đến bộ phận kinh doanh.
            </p>
            {pricingCards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
                Bảng giá quảng cáo đang được cập nhật.
              </div>
            ) : (
              <AdvertisingPricingTable cards={pricingCards} onSelect={setSelectedPricing} />
            )}
          </section>
        )}
      </div>

      {selectedCard && (
        <ServiceInquiryModal
          serviceName={selectedCard.title}
          inquiryType="advertising"
          onClose={() => setSelectedCard(null)}
        />
      )}
      {selectedPartner && (
        <ServicePartnerDetailModal
          partner={selectedPartner}
          onClose={() => setSelectedPartner(null)}
          onRequest={() => {
            setSelectedPartner(null);
            setSelectedPartnerInquiry(selectedPartner.title);
          }}
        />
      )}
      {selectedPartnerInquiry && (
        <ServiceInquiryModal
          serviceName={selectedPartnerInquiry}
          inquiryType="service-partner"
          onClose={() => setSelectedPartnerInquiry(null)}
        />
      )}
      {selectedPricing && (
        <ServiceInquiryModal
          serviceName={`${selectedPricing.format} — ${selectedPricing.price} / ${selectedPricing.unit}`}
          inquiryType="advertising-pricing"
          onClose={() => setSelectedPricing(null)}
        />
      )}
    </div>
  );
}
