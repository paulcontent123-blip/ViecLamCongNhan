import Link from "next/link";
import { getEmployerSession } from "@/lib/employer-auth";
import {
  getEmployerAccountTier,
  getEmployerCandidateViewUsage,
  listCandidatesForEmployer,
  getEmployerJobs,
  type CandidateListRow,
} from "@/lib/employer";
import { ACCOUNT_TIERS } from "@/lib/account-tiers";
import { PROVINCES, provinceName } from "@/lib/provinces";
import { JOB_INDUSTRIES, industryLabel } from "@/lib/industries";
import { ROUTES } from "@/lib/routes";
import { CandidateRevealButton } from "@/components/ntd/CandidateRevealButton";
import { IndustryFilterSelect } from "@/components/shared/IndustryFilterSelect";

function CandidateRow({ candidate }: { candidate: CandidateListRow }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/5 bg-white p-3.5">
      <div className="min-w-0">
        <div className="text-[13.5px] font-bold text-brand-navy">{candidate.full_name}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-brand-navy/50">
          {candidate.province && <span>📍 {provinceName(candidate.province)}</span>}
          {candidate.desired_industry && <span>🏭 {industryLabel(candidate.desired_industry)}</span>}
          {candidate.experience_years !== null && <span>🧑‍🔧 {candidate.experience_years} năm KN</span>}
        </div>
      </div>
      <CandidateRevealButton candidateId={candidate.id} />
    </div>
  );
}

async function MatchingCandidatesForJob({
  job,
}: {
  job: { id: string; title: string; province_code: string; industry: string };
}) {
  const { candidates } = await listCandidatesForEmployer({
    province: job.province_code,
    industry: job.industry,
    limit: 5,
  });

  if (candidates.length === 0) return null;

  return (
    <div>
      <div className="mb-1.5 text-[12.5px] font-bold text-brand-navy">
        Cho tin &ldquo;{job.title}&rdquo; ({provinceName(job.province_code)} · {industryLabel(job.industry)})
      </div>
      <div className="space-y-2">
        {candidates.map((c) => (
          <CandidateRow key={c.id} candidate={c} />
        ))}
      </div>
    </div>
  );
}

export default async function EmployerCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ province?: string; industry?: string }>;
}) {
  const sp = await searchParams;
  const session = await getEmployerSession();
  if (!session) return null;

  const accountTier = await getEmployerAccountTier(session.employerId);
  const perks = ACCOUNT_TIERS[accountTier];
  const isLocked = perks.candidateViewLimit === 0;

  const [viewedCount, { candidates, total }, jobs] = await Promise.all([
    getEmployerCandidateViewUsage(session.employerId),
    listCandidatesForEmployer({ province: sp.province, industry: sp.industry, limit: 20 }),
    perks.matchingSupport ? getEmployerJobs(session.employerId) : Promise.resolve([]),
  ]);

  const activeJobsWithIndustry = jobs.filter(
    (j): j is typeof j & { industry: string } => j.status === "approved" && !!j.industry,
  );
  const usagePct = isLocked ? 0 : Math.min(100, Math.round((viewedCount / perks.candidateViewLimit) * 100));

  return (
    <div className="space-y-6">
      {isLocked ? (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5">
          <div className="text-[13px] font-bold text-brand-navy">🔒 Gói Free — xem hồ sơ nhưng ẩn liên hệ</div>
          <p className="mt-1 text-[12.5px] text-brand-navy/55">
            Bạn vẫn xem được ngành nghề, tỉnh/thành, kinh nghiệm của ứng viên bên dưới. Nâng cấp Basic (60 hồ
            sơ/tháng) hoặc Premium (300 hồ sơ/tháng + matching) để xem số điện thoại/Zalo.{" "}
            <Link href={ROUTES.ntdDashboardOrders} className="font-bold text-brand-orange">
              Nâng cấp gói →
            </Link>
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] font-extrabold text-brand-navy">📂 Hồ sơ ứng viên — gói {perks.label}</div>
            <div className="font-mono text-[13px] font-bold text-brand-orange">
              {viewedCount}/{perks.candidateViewLimit} đã xem tháng này
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
            <div className="h-1.5 rounded-full bg-brand-orange" style={{ width: `${usagePct}%` }} />
          </div>
          {viewedCount >= perks.candidateViewLimit && (
            <p className="mt-2 text-[12px] text-brand-navy/50">
              Đã hết hạn mức tháng này — hồ sơ mới vẫn hiển thị nhưng ẩn thông tin liên hệ.{" "}
              <Link href={ROUTES.ntdDashboardOrders} className="font-bold text-brand-orange">
                Nâng cấp gói →
              </Link>
            </p>
          )}
        </div>
      )}

      {perks.matchingSupport && activeJobsWithIndustry.length > 0 && (
        <div className="rounded-2xl border-2 border-brand-orange bg-brand-orange-light p-5">
          <div className="mb-3 text-[13px] font-extrabold text-brand-navy">
            🎯 Gợi ý ứng viên phù hợp theo tin đang tuyển
          </div>
          <div className="space-y-4">
            {activeJobsWithIndustry.slice(0, 3).map((job) => (
              <MatchingCandidatesForJob key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="mb-3 text-[13px] font-extrabold text-brand-navy">🔎 Duyệt hồ sơ ứng viên</div>
        <form className="mb-4 flex flex-wrap gap-2" action={ROUTES.ntdDashboardCandidates}>
          <select
            name="province"
            defaultValue={sp.province ?? ""}
            className="rounded-lg border border-black/10 px-3 py-2 text-[12.5px] text-brand-navy outline-none focus:border-brand-orange"
          >
            <option value="">-- Tất cả tỉnh/thành --</option>
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
          <IndustryFilterSelect
            name="industry"
            defaultValue={sp.industry ?? ""}
            options={JOB_INDUSTRIES}
            allLabel="-- Tất cả ngành --"
            className="rounded-lg border border-black/10 px-3 py-2 text-[12.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-navy px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-brand-orange"
          >
            Lọc
          </button>
          {(sp.province || sp.industry) && (
            <Link
              href={ROUTES.ntdDashboardCandidates}
              className="rounded-lg border border-black/10 px-4 py-2 text-[12.5px] font-semibold text-brand-navy/60"
            >
              Xoá lọc
            </Link>
          )}
        </form>

        {candidates.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-brand-navy/40">
            Không tìm thấy ứng viên phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => (
              <CandidateRow key={c.id} candidate={c} />
            ))}
          </div>
        )}
        {total > candidates.length && (
          <p className="mt-3 text-center text-[12px] text-brand-navy/40">
            Hiển thị {candidates.length}/{total} hồ sơ phù hợp — thu hẹp bộ lọc để xem chính xác hơn.
          </p>
        )}
      </div>
    </div>
  );
}
