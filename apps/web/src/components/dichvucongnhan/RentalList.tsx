"use client";

import Link from "next/link";
import { useState } from "react";
import { RentalInquiryForm } from "@/components/dichvucongnhan/RentalInquiryForm";
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
import { ROUTES } from "@/lib/routes";
import { displayProvince, formatArea, formatRent, WORKER_SERVICES } from "@/lib/worker-services";
import type { RentalListing } from "@/types/worker-services";

const service = WORKER_SERVICES["thue-tro"];
const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));

/** Khoảng giá thuê. Máy chủ đòi maxRent >= minRent nên mỗi mốc ghi sẵn cặp giá trị hợp lệ. */
const RENT_RANGES: { label: string; minRent?: number; maxRent?: number }[] = [
  { label: "Dưới 1,5 triệu", maxRent: 1_500_000 },
  { label: "1,5 ‑ 3 triệu", minRent: 1_500_000, maxRent: 3_000_000 },
  { label: "3 ‑ 5 triệu", minRent: 3_000_000, maxRent: 5_000_000 },
  { label: "Trên 5 triệu", minRent: 5_000_000 },
];

export function RentalCardPhoto({ photos, title }: { photos: string[] | null; title: string }) {
  const list = (photos ?? []).filter((url) => typeof url === "string" && url.startsWith("https://"));
  if (!list.length) {
    return (
      <div className={`flex h-[160px] items-center justify-center rounded-xl text-[40px] ${service.accent.tint}`}>
        <span aria-hidden="true">🏠</span>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* eslint-disable-next-line @next/next/no-img-element -- dùng <img> như các phần ảnh từ xa khác của web */}
      <img src={list[0]} alt={`Ảnh phòng trọ: ${title}`} loading="lazy" className="h-[160px] w-full object-cover" />
      {list.length > 1 && (
        <span className="absolute bottom-2 right-2 rounded-full bg-brand-navy/70 px-2.5 py-1 text-[11px] font-bold text-white">
          +{list.length - 1} ảnh
        </span>
      )}
    </div>
  );
}

function ListingCard({ listing, onInquiry }: { listing: RentalListing; onInquiry: () => void }) {
  const place = [listing.location, displayProvince(listing.province_code, provinceName)].filter(Boolean).join(" · ");
  const area = formatArea(listing.area_sqm);
  const amenities = (listing.amenities ?? []).filter(Boolean).slice(0, 6);

  return (
    <article className="flex flex-col rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <RentalCardPhoto photos={listing.photo_urls} title={listing.title} />

      <div className="mt-3.5 flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-extrabold leading-snug text-brand-navy">{listing.title}</h3>
        <VerifiedBadge />
      </div>

      <div className={`mt-1.5 text-[16px] font-extrabold ${service.accent.text}`}>
        {formatRent(listing.monthly_rent_vnd)}
      </div>
      <p className="mt-0.5 text-[12.5px] text-brand-navy/45">{area ?? "Diện tích chưa cập nhật"}</p>

      <div className="mt-3 flex flex-col gap-1.5 text-[12.5px] text-brand-navy/60">
        {place && <span>📍 {place}</span>}
        {listing.nearby_industrial_zone && <span>🏭 Gần {listing.nearby_industrial_zone}</span>}
        {(listing.room_type || listing.capacity) && (
          <span>
            👥 {listing.room_type || "Phòng trọ"}
            {listing.capacity ? ` · ${listing.capacity} người` : ""}
          </span>
        )}
      </div>

      {amenities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {amenities.map((amenity) => (
            <span key={amenity} className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${service.accent.tint}`}>
              {amenity}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 flex-1 text-[12px] text-brand-navy/45">
        Đơn vị cho thuê: {listing.provider_name || "Đối tác đã xác minh"}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onInquiry}
          className={`flex-1 rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition ${service.accent.button}`}
        >
          Gửi yêu cầu tìm hiểu phòng
        </button>
        <Link
          href={`${ROUTES.thueTro}/${listing.id}`}
          className={`rounded-xl border px-4 py-2.5 text-[13px] font-bold transition hover:bg-black/[0.02] ${service.accent.border} ${service.accent.text}`}
        >
          Chi tiết
        </Link>
      </div>
    </article>
  );
}

export function RentalList() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [province, setProvince] = useState("");
  const [rangeIndex, setRangeIndex] = useState(-1);
  const [selected, setSelected] = useState<RentalListing | null>(null);

  const range = RENT_RANGES[rangeIndex];
  const list = useServiceList<RentalListing>("rentals", {
    q: query,
    province,
    minRent: range?.minRent,
    maxRent: range?.maxRent,
  });

  return (
    <>
      <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <SearchBar
          draft={draft}
          onDraftChange={setDraft}
          onSearch={() => setQuery(draft.trim())}
          placeholder="Tìm theo tên tin, địa điểm hoặc KCN…"
          label="Tìm phòng trọ"
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
          <Chip label="Mọi mức giá" active={rangeIndex < 0} onClick={() => setRangeIndex(-1)} accent={service.accent} />
          {RENT_RANGES.map((item, index) => (
            <Chip
              key={item.label}
              label={item.label}
              active={rangeIndex === index}
              onClick={() => setRangeIndex(index)}
              accent={service.accent}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        {list.loaded && <ResultCount shown={list.items.length} total={list.total} unit="tin cho thuê" />}

        {list.error && (
          <div className="mb-4">
            <StateCard
              tone="error"
              title="Chưa tải được tin thuê trọ"
              description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
              onRetry={list.reload}
            />
          </div>
        )}

        {list.loading && !list.items.length && !list.error && <StateCard tone="loading" title="Đang tải phòng trọ…" />}

        {list.loaded && !list.items.length && !list.loading && !list.error && (
          <StateCard
            tone="empty"
            title="Chưa có tin phù hợp"
            description="Thử đổi tỉnh/thành, mức giá hoặc từ khóa. Danh sách chỉ gồm tin đã được Admin duyệt của chủ trọ đã xác minh."
          />
        )}

        {list.items.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} onInquiry={() => setSelected(listing)} />
            ))}
          </div>
        )}

        {list.hasMore && (
          <LoadMoreButton
            loading={list.loadingMore}
            onClick={list.loadMore}
            accent={service.accent}
            label="Xem thêm tin cho thuê"
          />
        )}
      </div>

      {selected && (
        <RentalInquiryForm
          listingId={selected.id}
          listingTitle={selected.title}
          providerName={selected.provider_name}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
