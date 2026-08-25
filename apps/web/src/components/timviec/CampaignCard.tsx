import Link from "next/link";
import type { JobWithRelations } from "@/types/db";
import { ROUTES } from "@/lib/routes";
import { formatSalary, daysLeft, INDUSTRY_ICON } from "@/lib/job-format";
import { CAMPAIGN_THEMES, isCampaignTheme } from "@/lib/campaign-theme";

export function CampaignCard({ job }: { job: JobWithRelations }) {
  const companyName = job.employers?.company_name ?? "Nhà tuyển dụng ẩn danh";
  const theme = CAMPAIGN_THEMES[isCampaignTheme(job.campaign_theme) ? job.campaign_theme : "orange"];
  const remaining = daysLeft(job.expires_at);

  return (
    <Link
      href={`${ROUTES.chienDich}/${job.slug}`}
      className="group overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className={`relative flex h-[130px] items-center justify-center bg-gradient-to-br ${theme.gradientClass} text-[40px]`}>
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-brand-navy shadow-sm">
          ⭐ PR Featured
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-brand-navy/80 px-2.5 py-1 text-[10px] font-bold text-white">
          {job.quantity.toLocaleString("vi-VN")} người
        </span>
        {INDUSTRY_ICON[job.industry] ?? "🏭"}
      </div>
      <div className="p-4">
        <div className="truncate text-[11px] font-bold uppercase tracking-wide text-brand-navy/45">
          {companyName}
        </div>
        <div className="mt-1 truncate text-[14px] font-bold text-brand-navy">{job.title}</div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-brand-navy/50">
          {remaining !== null && <span>⏳ Còn {remaining} ngày</span>}
          <span>👥 {job.apply_count.toLocaleString("vi-VN")} đã nộp</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3">
          <div className="text-[13.5px] font-extrabold text-brand-orange">
            {formatSalary(job.salary_min, job.salary_max)}
          </div>
          <span className="text-[12px] font-bold text-brand-orange">Xem chiến dịch →</span>
        </div>
      </div>
    </Link>
  );
}
