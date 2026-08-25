import Link from "next/link";
import type { JobWithRelations } from "@/types/db";
import { ROUTES } from "@/lib/routes";
import { provinceName } from "@/lib/provinces";
import { industryLabel } from "@/lib/industries";
import { formatSalary, timeAgo, INDUSTRY_ICON } from "@/lib/job-format";

export function JobCard({ job }: { job: JobWithRelations }) {
  const companyName = job.employers?.company_name ?? "Nhà tuyển dụng ẩn danh";
  const tags: string[] = [];
  if (job.no_experience_required) tags.push("Không cần KN");
  if (job.has_shuttle) tags.push("Bao xe đưa đón");
  if (job.has_housing) tags.push("Nhà ở tập thể");
  if (job.has_meals) tags.push("Bao bữa ăn");

  const detailHref = `${ROUTES.timViecLam}/${job.slug}`;
  const applyHref = `${ROUTES.ungVien}?job=${encodeURIComponent(job.slug)}&title=${encodeURIComponent(job.title)}&company=${encodeURIComponent(companyName)}`;

  return (
    <div className="relative rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:shadow-md">
      {job.is_urgent && (
        <span className="absolute -top-2.5 left-5 z-10 rounded-full bg-red-500 px-2.5 py-1 text-[10.5px] font-bold text-white">
          ⚡ TUYỂN GẤP
        </span>
      )}
      {/* Link phủ toàn thẻ để bấm đâu cũng mở chi tiết — nút Ứng tuyển bên dưới
          nằm trên (z-10) để vẫn bấm được riêng, không bị link này chặn. Không
          dùng <Link> bọc ngoài vì HTML không cho phép lồng thẻ <a>. */}
      <Link href={detailHref} className="absolute inset-0 rounded-2xl" aria-label={`Xem chi tiết: ${job.title}`} />
      {/* Các div nội dung dưới đây CỐ Ý không đặt position:relative — nếu có,
          chúng sẽ cùng nhóm stacking (z-index:auto) với Link phủ ở trên và vì
          đứng sau trong DOM nên sẽ đè lên Link, làm bấm vào chữ (tiêu đề, tên
          công ty...) không mở được chi tiết, chỉ những khoảng trống giữa các
          phần tử mới bấm được. Để static, chúng luôn nằm dưới Link theo đúng
          thứ tự stacking của CSS, giữ cho toàn bộ thẻ bấm đâu cũng ăn. */}
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-orange-light text-xl">
          {INDUSTRY_ICON[job.industry] ?? "🏭"}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1 truncate text-[12.5px] font-semibold text-brand-navy/50">
            {companyName}
            {(job.tier === "basic" || job.tier === "premium" || job.tier === "campaign") && (
              <span
                title="Doanh nghiệp gói trả phí"
                className={job.tier === "basic" ? "text-brand-navy/40" : "text-brand-orange"}
              >
                ✓
              </span>
            )}
          </div>
          <div className="text-[14.5px] font-bold text-brand-navy">{job.title}</div>
          <div className="mt-0.5 text-[12.5px] text-brand-navy/45">
            📍 {job.kcn?.name ?? job.district ?? provinceName(job.province_code)} · {timeAgo(job.created_at)}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-brand-orange-light px-2.5 py-1 text-[11px] font-semibold text-brand-orange">
          {INDUSTRY_ICON[job.industry] ?? "🏭"} {industryLabel(job.industry)}
        </span>
        {tags.map((tag) => (
          <span key={tag} className="rounded-full bg-brand-navy/5 px-2.5 py-1 text-[11px] font-semibold text-brand-navy/60">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3">
        <div className="text-[14px] font-extrabold text-brand-orange">{formatSalary(job.salary_min, job.salary_max)}</div>
        <Link
          href={applyHref}
          className="relative z-10 rounded-lg bg-brand-navy px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-brand-orange"
        >
          Ứng tuyển →
        </Link>
      </div>
    </div>
  );
}
