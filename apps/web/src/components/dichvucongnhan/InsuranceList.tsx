"use client";

import { useState } from "react";
import { InsuranceInquiryForm } from "@/components/dichvucongnhan/InsuranceInquiryForm";
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
import { formatDate } from "@/lib/format-date";
import { provinceName } from "@/lib/provinces";
import {
  displayProvince,
  INSURANCE_CATEGORIES,
  INSURANCE_CATEGORY_LABEL,
  splitLines,
  WORKER_SERVICES,
} from "@/lib/worker-services";
import type { InsuranceProduct } from "@/types/worker-services";

const service = WORKER_SERVICES["bao-hiem"];

/** Link điều khoản do đối tác nhập: chỉ mở khi là https, mở tab mới và chặn truy cập window gốc. */
function termsHref(url: string | null): string | null {
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

function ProductCard({
  product,
  open,
  onToggle,
  onInquiry,
}: {
  product: InsuranceProduct;
  open: boolean;
  onToggle: () => void;
  onInquiry: () => void;
}) {
  const categoryLabel = INSURANCE_CATEGORY_LABEL[product.category] ?? "Khác";
  // Nhãn nhanh: loại bảo hiểm + hai ý đầu của phần quyền lợi, rút gọn như app.
  const tags = [
    categoryLabel,
    ...splitLines(product.benefits_summary)
      .slice(0, 2)
      .map((line) => (line.length > 30 ? `${line.slice(0, 29)}…` : line)),
  ];
  const terms = termsHref(product.terms_url);
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
              🛡️
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-extrabold leading-snug text-brand-navy">{product.title}</h3>
          <p className="mt-1 text-[12px] text-brand-navy/45">
            {product.provider?.provider_name || "Đơn vị cung cấp"}
            {province ? ` · ${province}` : ""}
          </p>
          {product.price_label && (
            <p className={`mt-1 text-[14px] font-extrabold ${service.accent.text}`}>{product.price_label}</p>
          )}
        </div>
        <VerifiedBadge />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${service.accent.tint}`}>
            {tag}
          </span>
        ))}
      </div>

      {product.subtitle && <p className="mt-3 text-[13px] font-semibold text-brand-navy/65">{product.subtitle}</p>}
      {product.description && (
        <p className={`mt-2 text-[13px] leading-relaxed text-brand-navy/60 ${open ? "" : "line-clamp-3"}`}>
          {product.description}
        </p>
      )}

      {open && (
        <div className="mt-4 rounded-xl bg-[#f6f7f9] px-4 py-2">
          <InfoRow label="Đơn vị cung cấp" value={product.provider?.provider_name || "Đơn vị cung cấp"} />
          <InfoRow label="Loại bảo hiểm" value={categoryLabel} />
          <InfoRow label="Quyền lợi tóm tắt" value={product.benefits_summary} />
          <InfoRow label="Điều kiện tham gia" value={product.eligibility_text} />
          <InfoRow label="Không thuộc phạm vi" value={product.exclusions_text} />
          <InfoRow
            label="Điều khoản cập nhật"
            value={product.updated_terms_at ? formatDate(product.updated_terms_at) : null}
          />
          {terms && (
            <div className="py-2.5">
              <a
                href={terms}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-[13px] font-bold underline ${service.accent.text}`}
              >
                Xem điều khoản đầy đủ của đơn vị ↗
              </a>
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

export function InsuranceList() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<InsuranceProduct | null>(null);

  const list = useServiceList<InsuranceProduct>("insurance/products", { q: query, category });

  return (
    <>
      <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <SearchBar
          draft={draft}
          onDraftChange={setDraft}
          onSearch={() => setQuery(draft.trim())}
          placeholder="Tên sản phẩm, quyền lợi…"
          label="Tìm sản phẩm bảo hiểm"
          accent={service.accent}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip label="Tất cả" active={!category} onClick={() => setCategory("")} accent={service.accent} />
          {INSURANCE_CATEGORIES.map((item) => (
            <Chip
              key={item}
              label={INSURANCE_CATEGORY_LABEL[item]}
              active={category === item}
              onClick={() => setCategory(item)}
              accent={service.accent}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        {list.loaded && <ResultCount shown={list.items.length} total={list.total} unit="sản phẩm" />}

        {list.error && (
          <div className="mb-4">
            <StateCard
              tone="error"
              title="Chưa tải được sản phẩm bảo hiểm"
              description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
              onRetry={list.reload}
            />
          </div>
        )}

        {list.loading && !list.items.length && !list.error && (
          <StateCard tone="loading" title="Đang tải sản phẩm bảo hiểm…" />
        )}

        {list.loaded && !list.items.length && !list.loading && !list.error && (
          <StateCard
            tone="empty"
            title="Chưa có sản phẩm phù hợp"
            description="Thử đổi từ khóa hoặc loại bảo hiểm. Danh sách chỉ gồm sản phẩm đã được Admin duyệt của đơn vị đã xác minh."
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
            label="Xem thêm sản phẩm"
          />
        )}

        <p className="mt-6 rounded-xl border border-black/5 bg-white px-4 py-3 text-[12.5px] leading-relaxed text-brand-navy/55">
          Trang này chỉ giới thiệu sản phẩm và nhận yêu cầu tư vấn. ViecLamCongNhan.com không bán, không phát hành hợp
          đồng và không xử lý bồi thường ‑ mọi điều khoản do đơn vị cung cấp quyết định.
        </p>
      </div>

      {selected && (
        <InsuranceInquiryForm
          product={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
