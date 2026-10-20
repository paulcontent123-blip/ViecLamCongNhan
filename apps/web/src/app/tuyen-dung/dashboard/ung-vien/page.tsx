import { getEmployerSession } from "@/lib/employer-auth";
import {
  getEmployerApplications,
  getEmployerAccountTier,
  getEmployerCandidateViewUsage,
  isEmployerVerified,
} from "@/lib/employer";
import { ACCOUNT_TIERS } from "@/lib/account-tiers";
import { provinceName } from "@/lib/provinces";
import { industryLabel } from "@/lib/industries";
import { ApplicationStatusSelect } from "@/components/ntd/ApplicationStatusSelect";
import { CandidateRevealButton } from "@/components/ntd/CandidateRevealButton";

export default async function EmployerApplicationsPage() {
  const session = await getEmployerSession();
  if (!session) return null;

  const [applications, accountTier, viewedCount, verified] = await Promise.all([
    getEmployerApplications(session.employerId),
    getEmployerAccountTier(session.employerId),
    getEmployerCandidateViewUsage(session.employerId),
    isEmployerVerified(session.employerId),
  ]);
  const perks = ACCOUNT_TIERS[accountTier];
  const usagePct = perks.candidateViewLimit > 0 ? Math.min(100, Math.round((viewedCount / perks.candidateViewLimit) * 100)) : 100;

  return (
    <div>
      <h2 className="mb-4 text-[15px] font-extrabold text-brand-navy">
        👥 Ứng viên đã ứng tuyển ({applications.length})
      </h2>

      <div className="mb-4 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[12.5px] font-bold text-brand-navy">
            📞 Lượt xem thông tin liên hệ ‑ gói {perks.label}
          </div>
          <div className="font-mono text-[12.5px] font-bold text-brand-orange">
            {perks.candidateViewLimit > 0 ? `${viewedCount}/${perks.candidateViewLimit} đã xem tháng này` : "Chưa mở khoá"}
          </div>
        </div>
        {perks.candidateViewLimit > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
            <div className="h-1.5 rounded-full bg-brand-orange" style={{ width: `${usagePct}%` }} />
          </div>
        )}
        <p className="mt-2 text-[11.5px] text-brand-navy/45">
          Hạn mức xem SĐT/Zalo dùng chung cho cả ứng viên tự ứng tuyển và hồ sơ duyệt từ database, tính theo
          ứng viên duy nhất/tháng.
        </p>
      </div>

      {applications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
          Chưa có ứng viên nào ứng tuyển vào tin của bạn.
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <div key={app.id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-bold text-brand-navy">
                    {app.candidates?.full_name ?? "Ứng viên"}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-brand-navy/50">
                    Ứng tuyển: <span className="font-semibold text-brand-navy/70">{app.jobs?.title ?? "‑"}</span>
                  </div>
                </div>
                <ApplicationStatusSelect applicationId={app.id} currentStatus={app.status} verified={verified} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-brand-navy/60">
                {app.candidates && <CandidateRevealButton candidateId={app.candidates.id} />}
                {app.candidates?.province && <span>📍 {provinceName(app.candidates.province)}</span>}
                {app.candidates?.desired_industry && (
                  <span>🏭 {industryLabel(app.candidates.desired_industry)}</span>
                )}
                {app.candidates?.experience_years !== null && app.candidates?.experience_years !== undefined && (
                  <span>🧑‍🔧 {app.candidates.experience_years} năm KN</span>
                )}
              </div>

              <div className="mt-2 text-[11.5px] text-brand-navy/35">
                Ứng tuyển lúc {new Date(app.created_at).toLocaleString("vi-VN")}
                {app.updated_at !== app.created_at && (
                  <> · Cập nhật lúc {new Date(app.updated_at).toLocaleString("vi-VN")}</>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
