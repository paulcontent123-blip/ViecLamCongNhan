"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RentalInquiryForm } from "@/components/dichvucongnhan/RentalInquiryForm";
import { InfoRow, StateCard, VerifiedBadge } from "@/components/dichvucongnhan/ui";
import { provinceName } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";
import { fetchDetail, WorkerServiceError } from "@/lib/worker-service-client";
import { displayProvince, formatArea, formatRent, WORKER_SERVICES } from "@/lib/worker-services";
import type { RentalListing } from "@/types/worker-services";

const service = WORKER_SERVICES["thue-tro"];

/** Chỉ nhận ảnh https (máy chủ đã ràng buộc khi chủ trọ tải lên); bỏ giá trị lạ thay vì render thẻ ảnh lỗi. */
function photosOf(listing: RentalListing): string[] {
  return (listing.photo_urls ?? []).filter((url) => typeof url === "string" && url.startsWith("https://"));
}

function Gallery({ listing }: { listing: RentalListing }) {
  const photos = photosOf(listing);
  const [active, setActive] = useState(0);
  if (!photos.length) {
    return (
      <div className={`flex h-[220px] items-center justify-center rounded-2xl text-[56px] ${service.accent.tint}`}>
        <span aria-hidden="true">🏠</span>
      </div>
    );
  }
  const current = photos[Math.min(active, photos.length - 1)];
  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element -- dùng <img> như các phần ảnh từ xa khác của web */}
      <img
        src={current}
        alt={`Ảnh phòng trọ: ${listing.title}`}
        className="max-h-[420px] w-full rounded-2xl object-cover"
      />
      {photos.length > 1 && (
        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Xem ảnh ${index + 1}`}
              aria-current={index === active ? "true" : undefined}
              className={`shrink-0 overflow-hidden rounded-lg border-2 transition ${
                index === active ? service.accent.border : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh nhỏ chọn nhanh, cùng nguồn với ảnh lớn */}
              <img src={url} alt="" loading="lazy" className="h-16 w-20 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RentalDetail({ listingId }: { listingId: string }) {
  const [listing, setListing] = useState<RentalListing | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotFound(false);
    try {
      setListing(
        await fetchDetail<RentalListing>(`rentals/${encodeURIComponent(listingId)}`, "listing", listingId),
      );
    } catch (err) {
      if (err instanceof WorkerServiceError && err.status === 404) setNotFound(true);
      else setError(err instanceof Error ? err.message : "Chưa tải được tin cho thuê.");
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <StateCard tone="loading" title="Đang tải tin cho thuê…" />;

  if (notFound) {
    return (
      <StateCard
        tone="empty"
        title="Tin cho thuê không còn công khai"
        description="Phòng có thể đã có người thuê, tin đã bị gỡ hoặc chủ trọ không còn được xác minh."
      />
    );
  }

  if (error || !listing) {
    return <StateCard tone="error" title="Chưa tải được tin cho thuê" description={error} onRetry={load} />;
  }

  const place = [listing.location, displayProvince(listing.province_code, provinceName)].filter(Boolean).join(" · ");
  const amenities = (listing.amenities ?? []).filter(Boolean);

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <article className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-6">
          <Gallery listing={listing} />

          <div className="mt-5 flex items-start justify-between gap-3">
            <h2 className="text-[20px] font-extrabold leading-snug text-brand-navy sm:text-[24px]">{listing.title}</h2>
            <VerifiedBadge />
          </div>
          <div className={`mt-2 text-[22px] font-extrabold ${service.accent.text}`}>
            {formatRent(listing.monthly_rent_vnd)}
          </div>

          <div className="mt-5">
            <InfoRow label="Địa điểm" value={place || null} />
            <InfoRow label="Gần khu công nghiệp" value={listing.nearby_industrial_zone} />
            <InfoRow label="Diện tích" value={formatArea(listing.area_sqm)} />
            <InfoRow label="Loại phòng" value={listing.room_type} />
            <InfoRow label="Số người ở" value={listing.capacity == null ? null : `${listing.capacity} người`} />
            <InfoRow label="Đơn vị cho thuê" value={listing.provider_name || "Đối tác đã xác minh"} />
          </div>

          {amenities.length > 0 && (
            <>
              <h3 className="mt-6 text-[15px] font-extrabold text-brand-navy">Tiện ích</h3>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {amenities.map((amenity) => (
                  <span
                    key={amenity}
                    className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${service.accent.tint}`}
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            </>
          )}

          {listing.description && (
            <>
              <h3 className="mt-6 text-[15px] font-extrabold text-brand-navy">Mô tả</h3>
              <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-brand-navy/70">
                {listing.description}
              </p>
            </>
          )}
        </article>

        <aside className="lg:sticky lg:top-[76px] lg:self-start">
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
            <div className={`text-[12px] font-bold uppercase tracking-wider ${service.accent.text}`}>Liên hệ phòng</div>
            <p className="mt-2 text-[13px] leading-relaxed text-brand-navy/60">
              Số điện thoại của bạn chỉ được chuyển cho chủ trọ của tin này sau khi bạn gửi yêu cầu.
            </p>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className={`mt-4 w-full rounded-xl py-3 text-[14px] font-extrabold transition ${service.accent.button}`}
            >
              Gửi yêu cầu tìm hiểu phòng
            </button>
            <p className="mt-3 text-[12px] leading-relaxed text-brand-navy/45">
              Đây là yêu cầu tìm hiểu phòng, chưa phải đặt cọc hay hợp đồng thuê.
            </p>
            <Link
              href={ROUTES.thueTro}
              className="mt-4 block text-center text-[12.5px] font-semibold text-brand-navy/50 hover:text-brand-orange"
            >
              ← Xem tin cho thuê khác
            </Link>
          </div>
        </aside>
      </div>

      {formOpen && (
        <RentalInquiryForm
          listingId={listing.id}
          listingTitle={listing.title}
          providerName={listing.provider_name}
          onClose={() => setFormOpen(false)}
        />
      )}
    </>
  );
}
