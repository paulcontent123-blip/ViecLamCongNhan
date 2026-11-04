"use client";

import { useState } from "react";
import { FinanceInquiryForm } from "@/components/dichvucongnhan/FinanceInquiryForm";
import { useServiceList } from "@/components/dichvucongnhan/hooks";
import {
  Chip,
  InfoRow,
  LoadMoreButton,
  ResultCount,
  SearchBar,
  StateCard,
  VerifiedBadge,
} from "@/components/dichvucongnhan/ui";
import { provinceName } from "@/lib/provinces";
import {
  displayProvince,
  FINANCE_PUBLIC_CATEGORIES,
  FINANCE_PUBLIC_CATEGORY_LABEL,
  formatCalendarDate,
  WORKER_SERVICES,
} from "@/lib/worker-services";
import type { FinanceProduct } from "@/types/worker-services";

const service = WORKER_SERVICES["tai-chinh"];
const ICONS: Record<string, string> = { ewa: "⚡", consumer_loan: "💳", remittance: "🏠" };

function termsHref(url: string | null): string | null {
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

function ProductCard({
  product,
  open,
  onToggle,
  onInquiry,
}: {
  product: FinanceProduct;
  open: boolean;
  onToggle: () => void;
  onInquiry: () => void;
}) {
  const categoryLabel = FINANCE_PUBLIC_CATEGORY_LABEL[product.category] ?? product.category;
  const terms = termsHref(product.terms_url);
  const pricingSource = termsHref(product.pricing_source_url);
  const logo = product.provider?.logo_url;
  const province = displayProvince(product.provider?.province_code, provinceName);

  return (
    <article className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl ${service.accent.tint}`}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- dùng <img> như các phần ảnh từ xa khác của web
            <img src={logo} alt="" loading="lazy" className="h-full w-full object-contain" />
          ) : (
            <span aria-hidden="true" className="text-[22px]">
              {ICONS[product.category] ?? "💼"}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-extrabold leading-snug text-brand-navy">{product.title}</h3>
          <p className="mt-1 text-[12px] text-brand-navy/45">
            {categoryLabel} · {product.provider?.provider_name || "Đơn vị đã xác minh"}
            {province ? ` · ${province}` : ""}
          </p>
        </div>
        <VerifiedBadge />
      </div>

      {product.subtitle && <p className="mt-3 text-[13px] font-semibold text-brand-navy/65">{product.subtitle}</p>}
      {product.description && (
        <p className={`mt-2 text-[13px] leading-relaxed text-brand-navy/60 ${open ? "" : "line-clamp-4"}`}>
          {product.description}
        </p>
      )}

      {/* Máy chủ chỉ trả price_label khi bảng giá đã được duyệt; nói rõ điều đó thay vì hiện số trần trụi. */}
      {product.price_label ? (
        <p className={`mt-3 text-[13px] font-bold ${service.accent.text}`}>
          Thông tin phí/lãi đã được duyệt: {product.price_label}
        </p>
      ) : (
        <p className="mt-3 text-[12.5px] text-brand-navy/45">
          Phí và lãi chưa được công bố ‑ hỏi trực tiếp đơn vị khi được liên hệ.
        </p>
      )}
      {product.pricing_effective_at && (
        <p className="mt-0.5 text-[12px] text-brand-navy/45">
          Hiệu lực từ {formatCalendarDate(product.pricing_effective_at)}
        </p>
      )}

      {open && (
        <div className="mt-4 rounded-xl bg-[#f6f7f9] px-4 py-2">
          <InfoRow label="Đơn vị cung cấp" value={product.provider?.provider_name || "Đơn vị đã xác minh"} />
          <InfoRow label="Nhóm dịch vụ" value={categoryLabel} />
          <InfoRow label="Thông tin" value={product.benefits_summary} />
          <InfoRow label="Điều kiện" value={product.eligibility_text} />
          <InfoRow label="Không thuộc phạm vi" value={product.exclusions_text} />
          {(terms || pricingSource) && (
            <div className="flex flex-col gap-1.5 py-2.5">
              {terms && (
                <a
                  href={terms}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-[13px] font-bold underline ${service.accent.text}`}
                >
                  Đọc điều khoản chính thức ↗
                </a>
              )}
              {pricingSource && (
                <a
                  href={pricingSource}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-[13px] font-bold underline ${service.accent.text}`}
                >
                  Nguồn công bố phí/lãi ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onInquiry}
          className={`flex-1 rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition ${service.accent.button}`}
        >
          Yêu cầu tư vấn
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={`rounded-xl border px-4 py-2.5 text-[13px] font-bold transition hover:bg-black/[0.02] ${service.accent.border} ${service.accent.text}`}
        >
          {open ? "Thu gọn" : "Xem chi tiết"}
        </button>
      </div>
    </article>
  );
}

export function FinanceList() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<FinanceProduct | null>(null);

  const list = useServiceList<FinanceProduct>("finance/products", { q: query, category });

  return (
    <>
      <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <SearchBar
          draft={draft}
          onDraftChange={setDraft}
          onSearch={() => setQuery(draft.trim())}
          placeholder="Tên dịch vụ, đơn vị…"
          label="Tìm dịch vụ tài chính"
          accent={service.accent}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip label="Tất cả" active={!category} onClick={() => setCategory("")} accent={service.accent} />
          {FINANCE_PUBLIC_CATEGORIES.map((item) => (
            <Chip
              key={item}
              label={FINANCE_PUBLIC_CATEGORY_LABEL[item]}
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
              title="Chưa tải được sản phẩm tài chính"
              description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
              onRetry={list.reload}
            />
          </div>
        )}

        {list.loading && !list.items.length && !list.error && (
          <StateCard tone="loading" title="Đang tải dịch vụ tài chính…" />
        )}

        {list.loaded && !list.items.length && !list.loading && !list.error && (
          <StateCard
            tone="empty"
            title="Chưa có sản phẩm trong nhóm này"
            description="Chỉ sản phẩm đã được Admin duyệt, có bảng phí/lãi đã duyệt và của đơn vị đã xác minh mới hiện ở đây."
          />
        )}

        {list.items.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {list.items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                open={openId === product.id}
                onToggle={() => setOpenId((current) => (current === product.id ? null : product.id))}
                onInquiry={() => setSelected(product)}
              />
            ))}
          </div>
        )}

        {list.hasMore && (
          <LoadMoreButton
            loading={list.loadingMore}
            onClick={list.loadMore}
            accent={service.accent}
            label="Xem thêm dịch vụ"
          />
        )}

        <p className="mt-6 rounded-xl border border-black/5 bg-white px-4 py-3 text-[12.5px] leading-relaxed text-brand-navy/55">
          Yêu cầu ở đây chỉ để đơn vị liên hệ tư vấn. ViecLamCongNhan.com không tiếp nhận hồ sơ vay, thông tin ngân
          hàng, không ra quyết định tín dụng, không giải ngân và không chuyển tiền.
        </p>
      </div>

      {selected && <FinanceInquiryForm product={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
