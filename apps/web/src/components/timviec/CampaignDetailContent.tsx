import Link from "next/link";
import type { JobWithRelations } from "@/types/db";
import { ROUTES } from "@/lib/routes";
import { provinceName } from "@/lib/provinces";
import { industryLabel } from "@/lib/industries";
import { formatSalary, daysLeft, INDUSTRY_ICON, jobTypeLabel, shiftLabel } from "@/lib/job-format";
import { CAMPAIGN_THEMES, isCampaignTheme } from "@/lib/campaign-theme";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-brand-navy/70 shadow-sm">
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="text-[13px] font-extrabold uppercase tracking-wide text-brand-navy/40">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function CampaignDetailContent({ job }: { job: JobWithRelations }) {
  const companyName = job.employers?.company_name ?? "Nhà tuyển dụng ẩn danh";
  const location = job.kcn?.name ?? job.district ?? provinceName(job.province_code);
  const theme = CAMPAIGN_THEMES[isCampaignTheme(job.campaign_theme) ? job.campaign_theme : "orange"];
  const remaining = daysLeft(job.expires_at);

  const tags: string[] = [];
  if (job.no_experience_required) tags.push("Không cần kinh nghiệm");
  if (job.has_shuttle) tags.push("Bao xe đưa đón");
  if (job.has_housing) tags.push("Nhà ở tập thể");
  if (job.has_meals) tags.push("Bao bữa ăn");

  const applyHref = `${ROUTES.ungVien}?job=${encodeURIComponent(job.slug)}&title=${encodeURIComponent(job.title)}&company=${encodeURIComponent(companyName)}`;

  return (
    <div>
      <div className={`relative flex h-[180px] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${theme.gradientClass} text-[64px] sm:h-[220px]`}>
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold text-brand-navy shadow-sm">
          ⭐ PR Featured ‑ Chiến dịch tuyển dụng
        </span>
        <span className="absolute right-4 top-4 rounded-full bg-brand-navy/80 px-3 py-1.5 text-[11px] font-bold text-white">
          Tuyển {job.quantity.toLocaleString("vi-VN")} người
        </span>
        {INDUSTRY_ICON[job.industry] ?? "🏭"}
      </div>

      <div className="mt-5 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {job.is_urgent && (
            <span className="mb-1 inline-block rounded-full bg-red-500 px-2.5 py-1 text-[10.5px] font-bold text-white">
              ⚡ TUYỂN GẤP
            </span>
          )}
          <div className="truncate text-[13px] font-semibold text-brand-navy/50">{companyName}</div>
          <h1 className="text-[20px] font-extrabold leading-tight text-brand-navy sm:text-[24px]">{job.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-brand-navy/45">
            <span>📍 {location}</span>
            {remaining !== null && (
              <>
                <span>·</span>
                <span>⏳ Còn {remaining} ngày</span>
              </>
            )}
            <span>·</span>
            <span>👥 {job.apply_count.toLocaleString("vi-VN")} đã nộp</span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5 rounded-xl bg-brand-orange-light p-4">
        <div className="text-[18px] font-extrabold text-brand-orange">{formatSalary(job.salary_min, job.salary_max)}</div>
        <Pill>Tuyển {job.quantity} người</Pill>
        {jobTypeLabel(job.job_type) && <Pill>{jobTypeLabel(job.job_type)}</Pill>}
        {shiftLabel(job.shift_type) && <Pill>{shiftLabel(job.shift_type)}</Pill>}
      </div>

      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-black/5 bg-brand-navy/5 px-3 py-1.5 text-[12px] font-semibold text-brand-navy/60"
            >
              ✓ {tag}
            </span>
          ))}
        </div>
      )}

      {job.campaign_story && (
        <Section title="Về chiến dịch này">
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-brand-navy/70">{job.campaign_story}</p>
        </Section>
      )}

      <Section title="Mô tả công việc">
        <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-brand-navy/70">{job.description}</p>
      </Section>

      {job.requirements && (
        <Section title="Yêu cầu ứng viên">
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-brand-navy/70">{job.requirements}</p>
        </Section>
      )}

      <Section title="Thông tin thêm">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
          <div className="flex justify-between border-b border-black/5 py-1.5 sm:justify-start sm:gap-2">
            <dt className="text-brand-navy/45">Ngành nghề</dt>
            <dd className="font-semibold text-brand-navy/80">{industryLabel(job.industry)}</dd>
          </div>
          <div className="flex justify-between border-b border-black/5 py-1.5 sm:justify-start sm:gap-2">
            <dt className="text-brand-navy/45">Tỉnh / thành</dt>
            <dd className="font-semibold text-brand-navy/80">{provinceName(job.province_code)}</dd>
          </div>
        </dl>
      </Section>

      <div className="sticky bottom-0 -mx-6 mt-6 flex items-center justify-between gap-3 border-t border-black/5 bg-white px-6 py-4 sm:-mx-0 sm:rounded-b-2xl">
        <div className="text-[16px] font-extrabold text-brand-orange">{formatSalary(job.salary_min, job.salary_max)}</div>
        <Link
          href={applyHref}
          className="whitespace-nowrap rounded-xl bg-brand-orange px-6 py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105"
        >
          Ứng tuyển ngay →
        </Link>
      </div>
    </div>
  );
}
