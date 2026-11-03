import type { PublicAd } from "@/lib/ads";

// Khung hiển thị quảng cáo trên web. Liên kết mở tab mới và gắn nofollow/sponsored vì là nội dung trả phí.
const REL = "sponsored nofollow noopener noreferrer";

function AdLabel() {
  return <span className="absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Quảng cáo</span>;
}

function AdImage({ ad, className }: { ad: PublicAd; className: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={ad.imageUrl ?? ""} alt={ad.title} loading="lazy" className={className} />;
}

function wrap(ad: PublicAd, children: React.ReactNode, className: string) {
  return ad.linkUrl ? (
    <a href={ad.linkUrl} target="_blank" rel={REL} className={className}>{children}</a>
  ) : (
    <div className={className}>{children}</div>
  );
}

/** Banner ngang (trang chủ, KCN). */
export function AdBanner({ ad }: { ad: PublicAd | undefined }) {
  if (!ad?.imageUrl) return null;
  return wrap(
    ad,
    <>
      <AdImage ad={ad} className="aspect-[3/1] w-full object-cover" />
      <AdLabel />
    </>,
    "relative block overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm",
  );
}

/** Ảnh dọc trong cột bên của trang Tìm việc. */
export function AdSidebar({ ad }: { ad: PublicAd | undefined }) {
  if (!ad?.imageUrl) return null;
  return wrap(
    ad,
    <>
      <AdImage ad={ad} className="aspect-[1/2] w-full object-cover" />
      <AdLabel />
    </>,
    "relative mt-4 block overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm",
  );
}

/** Card nhà trọ/dịch vụ; card HOT có nhãn nổi bật (danh sách đã được xếp HOT trước). */
export function AdServiceCard({ ad }: { ad: PublicAd }) {
  return wrap(
    ad,
    <>
      {ad.isHot && <span className="absolute left-3 top-3 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-white shadow">🔥 Hot</span>}
      {ad.imageUrl && <AdImage ad={ad} className="aspect-video w-full object-cover" />}
      <div className={`p-4 ${ad.isHot && !ad.imageUrl ? "pt-10" : ""}`}>
        <div className="text-[14px] font-bold text-brand-navy">{ad.title}</div>
        {ad.body && <p className="mt-1 text-[12.5px] text-brand-navy/60">{ad.body}</p>}
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-brand-navy/35">Quảng cáo</div>
      </div>
    </>,
    `relative block overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${ad.isHot ? "border-red-300" : "border-black/5"}`,
  );
}
