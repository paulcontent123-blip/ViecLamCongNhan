import type { Metadata } from "next";
import Link from "next/link";
import { WORKER_SERVICE_LIST } from "@/lib/worker-services";

export const metadata: Metadata = {
  title: "Dịch vụ cho công nhân | ViecLamCongNhan.com",
  description:
    "Học nghề, thuê trọ gần khu công nghiệp, bảo hiểm, tài chính và y tế từ các đơn vị đã xác minh. Xem thông tin đã được duyệt và gửi yêu cầu tư vấn miễn phí.",
};

export default function DichVuCongNhanPage() {
  return (
    <div className="bg-[#f6f7f9] px-4 py-14 sm:px-8 sm:py-16 lg:px-[52px]">
      <div className="mx-auto max-w-6xl">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">Dịch vụ cho công nhân</div>
        <h1 className="mt-3 max-w-2xl text-[30px] font-extrabold leading-tight text-brand-navy sm:text-[42px]">
          Không chỉ việc làm ‑
          <br />
          <em className="text-brand-orange not-italic">cả những thứ đi kèm cuộc sống công nhân</em>
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-brand-navy/60">
          Học nghề, phòng trọ gần khu công nghiệp, bảo hiểm, tài chính và y tế. Mọi nội dung ở đây đều từ đơn vị đã
          xác minh và đã được Admin duyệt. Bạn xem miễn phí, chỉ để lại số điện thoại khi muốn được liên hệ tư vấn.
        </p>

        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {WORKER_SERVICE_LIST.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="flex flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl text-[24px] ${item.accent.tint}`}
                aria-hidden="true"
              >
                {item.icon}
              </div>
              <h2 className="mt-4 text-[17px] font-extrabold text-brand-navy">{item.title}</h2>
              <p className="mt-1.5 text-[13px] font-semibold text-brand-navy/50">{item.tagline}</p>
              <p className="mt-3 flex-1 text-[13px] leading-relaxed text-brand-navy/55">{item.description}</p>
              <span className={`mt-5 text-[13px] font-bold ${item.accent.text}`}>Xem {item.title.toLowerCase()} →</span>
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-brand-orange/20 bg-brand-orange-light px-5 py-4 text-[13px] leading-relaxed text-brand-navy/70">
          <strong className="font-extrabold text-brand-navy">Thông tin của bạn được giữ thế nào?</strong> Khi bạn gửi
          yêu cầu, thông tin về Admin của ViecLamCongNhan.com để liên hệ tư vấn. Chỉ khi bạn tự tích ô đồng ý riêng thì
          thông tin mới được chia sẻ cho đối tác. Cần hỗ trợ ngay, gọi hotline{" "}
          <a href="tel:0767977415" className="font-bold text-brand-orange">
            0767977415
          </a>
          .
        </div>
      </div>
    </div>
  );
}
