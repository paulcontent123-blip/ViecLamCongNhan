import type { HomeStats } from "@/lib/home-stats";

export function StatsBar({ stats }: { stats: HomeStats }) {
  const items = [
    { n: stats.approvedJobs.toLocaleString("vi-VN"), l: "Tin đang tuyển", color: "text-brand-orange" },
    { n: stats.employers.toLocaleString("vi-VN"), l: "Nhà máy & KCN", color: "text-emerald-600" },
    { n: stats.candidates.toLocaleString("vi-VN"), l: "Ứng viên đã đăng ký", color: "text-sky-600" },
    { n: String(stats.provinces), l: "Tỉnh thành", color: "text-brand-orange" },
    { n: `${stats.salaryMinM}–${stats.salaryMaxM}M`, l: "Khoảng lương phổ biến", color: "text-brand-orange" },
  ];

  return (
    <div className="border-y border-black/5 bg-white px-4 py-6 sm:px-8 lg:px-[52px]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 text-center sm:grid-cols-5">
        {items.map((s) => (
          <div key={s.l}>
            <div className={`text-[22px] font-extrabold sm:text-[26px] ${s.color}`}>{s.n}</div>
            <div className="mt-1 text-[12px] font-medium text-brand-navy/50">{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
