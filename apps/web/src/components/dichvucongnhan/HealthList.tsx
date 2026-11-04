"use client";

import { useState } from "react";
import { HealthInquiryForm } from "@/components/dichvucongnhan/HealthInquiryForm";
import { useServiceList } from "@/components/dichvucongnhan/hooks";
import {
  Chip,
  LoadMoreButton,
  ResultCount,
  SearchBar,
  SelectField,
  StateCard,
  VerifiedBadge,
} from "@/components/dichvucongnhan/ui";
import { PROVINCES, provinceName } from "@/lib/provinces";
import { displayProvince, HEALTH_CATEGORIES, HEALTH_CATEGORY_LABEL, WORKER_SERVICES } from "@/lib/worker-services";
import type { HealthService } from "@/types/worker-services";

const service = WORKER_SERVICES["y-te"];
const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));

function ServiceCard({ item, onInquiry }: { item: HealthService; onInquiry: () => void }) {
  const place = [item.address || item.provider?.address, displayProvince(item.province_code, provinceName)].filter(Boolean).join(" · ");
  const logo = item.provider?.logo_url;

  return (
    <article className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl ${service.accent.tint}`}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- dùng <img> như các phần ảnh từ xa khác của web
            <img src={logo} alt="" loading="lazy" className="h-full w-full object-contain" />
          ) : (
            <span aria-hidden="true" className="text-[21px]">
              🏥
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14.5px] font-extrabold leading-snug text-brand-navy">
            {item.provider?.provider_name || "Cơ sở y tế đã xác minh"}
          </h3>
          <p className="mt-1 text-[12px] text-brand-navy/45">{place || "Chưa cập nhật địa chỉ"}</p>
        </div>
        <VerifiedBadge />
      </div>

      <h4 className="mt-3.5 text-[16px] font-extrabold leading-snug text-brand-navy">{item.title}</h4>
      <p className={`mt-1 text-[13px] font-bold ${service.accent.text}`}>
        {item.specialty || HEALTH_CATEGORY_LABEL[item.category] || "Dịch vụ y tế"}
      </p>

      {item.description && (
        <p className="mt-2 text-[13px] leading-relaxed text-brand-navy/60">{item.description}</p>
      )}

      <div className="mt-3 flex flex-col gap-1.5 text-[12.5px] text-brand-navy/55">
        <span>⏰ {item.opening_hours || "Liên hệ để biết giờ hoạt động"}</span>
        <span>💳 {item.price_label || "Liên hệ cơ sở để biết chi phí"}</span>
        {item.accepts_bhyt && (
          <span className="font-bold text-[#146C43]">Có tiếp nhận BHYT · xác nhận trực tiếp với cơ sở</span>
        )}
      </div>

      <button
        type="button"
        onClick={onInquiry}
        className={`mt-4 w-full rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition ${service.accent.button}`}
      >
        Gửi yêu cầu tư vấn / đặt lịch
      </button>
    </article>
  );
}

export function HealthList() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [province, setProvince] = useState("");
  const [selected, setSelected] = useState<HealthService | null>(null);

  const list = useServiceList<HealthService>("health/services", { q: query, category, province });

  return (
    <>
      <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <SearchBar
          draft={draft}
          onDraftChange={setDraft}
          onSearch={() => setQuery(draft.trim())}
          placeholder="Tên cơ sở, dịch vụ, chuyên khoa…"
          label="Tìm dịch vụ y tế"
          accent={service.accent}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Tỉnh/thành"
            name="province"
            value={province}
            onChange={setProvince}
            options={PROVINCE_OPTIONS}
            placeholder="Tất cả tỉnh/thành"
            accent={service.accent}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip label="Tất cả" active={!category} onClick={() => setCategory("")} accent={service.accent} />
          {HEALTH_CATEGORIES.map((item) => (
            <Chip
              key={item}
              label={HEALTH_CATEGORY_LABEL[item]}
              active={category === item}
              onClick={() => setCategory(item)}
              accent={service.accent}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        {list.loaded && <ResultCount shown={list.items.length} total={list.total} unit="dịch vụ" />}

        {list.error && (
          <div className="mb-4">
            <StateCard
              tone="error"
              title="Chưa tải được dịch vụ y tế"
              description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
              onRetry={list.reload}
            />
          </div>
        )}

        {list.loading && !list.items.length && !list.error && (
          <StateCard tone="loading" title="Đang tìm dịch vụ y tế…" />
        )}

        {list.loaded && !list.items.length && !list.loading && !list.error && (
          <StateCard
            tone="empty"
            title="Chưa có dịch vụ phù hợp"
            description="Thử đổi tỉnh/thành hoặc loại dịch vụ. Danh sách chỉ gồm nội dung đã được Admin duyệt của cơ sở đã xác minh."
          />
        )}

        {list.items.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {list.items.map((item) => (
              <ServiceCard key={item.id} item={item} onInquiry={() => setSelected(item)} />
            ))}
          </div>
        )}

        {list.hasMore && (
          <LoadMoreButton
            loading={list.loadingMore}
            onClick={list.loadMore}
            accent={service.accent}
            label="Tải thêm dịch vụ"
          />
        )}

        <p className="mt-6 rounded-xl border border-black/5 bg-white px-4 py-3 text-[12.5px] leading-relaxed text-brand-navy/55">
          Trang này chỉ giúp bạn liên hệ và hẹn lịch với cơ sở y tế. Không gửi triệu chứng, bệnh sử, chẩn đoán hay hồ
          sơ khám tại đây. Trường hợp cấp cứu, gọi 115.
        </p>
      </div>

      {selected && <HealthInquiryForm service={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
