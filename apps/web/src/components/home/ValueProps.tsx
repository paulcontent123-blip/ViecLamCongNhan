import { PartnerMarquee } from "./PartnerMarquee";
import type { HomeStats } from "@/lib/home-stats";

export function ValueProps({ stats }: { stats: HomeStats }) {
  const props = [
    {
      icon: "🏭",
      title: `${stats.employers.toLocaleString("vi-VN")} Doanh nghiệp`,
      desc: "Nhà máy, KCN đang sử dụng nền tảng tuyển dụng công nhân của ViecLamCongNhan",
    },
    {
      icon: "🤝",
      title: `${stats.revenuePartners.toLocaleString("vi-VN")} Đối tác tài chính`,
      desc: "Bảo hiểm, vay tiêu dùng, ví điện tử hỗ trợ công nhân tiếp cận dịch vụ tài chính phù hợp",
    },
    {
      icon: "⚖",
      title: "VEA Law & VEA Academy",
      desc: "Tư vấn pháp lý lao động và đào tạo tay nghề ‑ hệ sinh thái toàn diện của VEA Group",
    },
  ];

  return (
    <div className="px-4 py-14 sm:px-8 lg:px-[52px]">
      <div className="mx-auto max-w-6xl">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">
          Đối tác & Hợp tác
        </div>
        <h2 className="mt-2 text-[24px] font-extrabold leading-snug text-brand-navy sm:text-[28px]">
          Được tin tưởng bởi
          <br />
          <em className="text-brand-orange not-italic">các doanh nghiệp hàng đầu</em>
        </h2>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-brand-navy/55">
          ViecLamCongNhan.com phối hợp với các đối tác tài chính, bảo hiểm, tuyển dụng uy tín
          để cung cấp giải pháp toàn diện cho công nhân và nhà tuyển dụng.
        </p>

        <div className="mt-6">
          <PartnerMarquee />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {props.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-black/5 bg-white p-5 text-center shadow-sm"
            >
              <div className="text-[28px]">{p.icon}</div>
              <div className="mt-2 text-[14px] font-bold text-brand-navy">{p.title}</div>
              <div className="mt-1.5 text-[12.5px] leading-relaxed text-brand-navy/50">{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
