import Link from "next/link";
import { getEmployerSession } from "@/lib/employer-auth";
import {
  getEmployerById,
  getEmployerJobs,
  getEmployerApplications,
  countJobsPostedToday,
  getEmployerAccountTier,
} from "@/lib/employer";
import { ACCOUNT_TIERS } from "@/lib/account-tiers";
import { provinceName } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  premium: "Premium",
  campaign: "Chiến dịch",
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: "Chờ duyệt", className: "bg-amber-50 text-amber-700" },
  approved: { label: "Đang hiển thị", className: "bg-emerald-50 text-emerald-700" },
  closed: { label: "Đã đóng", className: "bg-black/5 text-brand-navy/50" },
  expired: { label: "Hết hạn", className: "bg-red-50 text-red-600" },
};

export default async function EmployerDashboardOverviewPage() {
  const session = await getEmployerSession();
  if (!session) return null; // middleware đã chặn từ trước, không thể tới đây

  const [employer, jobs, applications, postedToday, accountTier] = await Promise.all([
    getEmployerById(session.employerId),
    getEmployerJobs(session.employerId),
    getEmployerApplications(session.employerId),
    countJobsPostedToday(session.employerId),
    getEmployerAccountTier(session.employerId),
  ]);
  const perks = ACCOUNT_TIERS[accountTier];

  return (
    <div className="space-y-6">
      {employer && (
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-3 border-b border-black/5 pb-2.5 text-[13px] font-extrabold text-brand-navy">
            📋 Thông tin đơn vị
          </div>
          <div className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
            <div>
              <span className="text-brand-navy/40">Công ty: </span>
              <span className="font-semibold text-brand-navy">{employer.company_name}</span>
            </div>
            <div>
              <span className="text-brand-navy/40">SĐT liên hệ: </span>
              <span className="font-semibold text-brand-navy">{employer.contact_phone}</span>
            </div>
            <div>
              <span className="text-brand-navy/40">Tỉnh/thành: </span>
              <span className="font-semibold text-brand-navy">
                {employer.province_code ? provinceName(employer.province_code) : "Chưa cập nhật"}
              </span>
            </div>
            <div>
              <span className="text-brand-navy/40">Xác minh pháp nhân: </span>
              <span className={`font-semibold ${employer.is_verified ? "text-emerald-600" : "text-amber-600"}`}>
                {employer.is_verified ? "Đã xác minh" : "Chưa xác minh"}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between border-b border-black/5 pb-2.5">
          <div className="text-[13px] font-extrabold text-brand-navy">💳 Gói dịch vụ — {perks.label}</div>
          <Link href={ROUTES.ntdDashboardOrders} className="text-[12px] font-bold text-brand-orange">
            Nâng cấp gói →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-black/[0.03] p-3">
            <div className="font-mono text-[18px] font-extrabold text-brand-navy">
              {postedToday}/{perks.dailyPostLimit}
            </div>
            <div className="mt-0.5 text-[11px] text-brand-navy/45">Tin đã đăng hôm nay</div>
          </div>
          <div className="rounded-lg bg-black/[0.03] p-3">
            <div className="font-mono text-[18px] font-extrabold text-brand-navy">{jobs.length}</div>
            <div className="mt-0.5 text-[11px] text-brand-navy/45">Tổng số tin đã đăng</div>
          </div>
          <div className="rounded-lg bg-black/[0.03] p-3">
            <div className="font-mono text-[18px] font-extrabold text-brand-navy">{applications.length}</div>
            <div className="mt-0.5 text-[11px] text-brand-navy/45">Hồ sơ ứng viên nhận được</div>
          </div>
        </div>
        <p className="mt-4 text-[12.5px] text-brand-navy/50">
          Gói {perks.label}: {perks.dailyPostLimit} tin/ngày, hiển thị {perks.jobDurationDays} ngày
          {perks.candidateViewLimit > 0 && `, xem ${perks.candidateViewLimit} hồ sơ ứng viên/tháng`}.
        </p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between border-b border-black/5 pb-2.5">
          <div className="text-[13px] font-extrabold text-brand-navy">📋 Tin tuyển dụng của tôi</div>
          {employer?.is_verified ? (
            <Link
              href={ROUTES.ntdDashboardPostJob}
              className="rounded-lg bg-brand-orange px-3.5 py-2 text-[12px] font-bold text-white transition hover:brightness-105"
            >
              + Đăng tin mới
            </Link>
          ) : (
            <span
              title="Cần Admin xác minh tài khoản trước khi đăng tin"
              className="cursor-not-allowed rounded-lg bg-black/5 px-3.5 py-2 text-[12px] font-bold text-brand-navy/35"
            >
              🔒 + Đăng tin mới
            </span>
          )}
        </div>

        {jobs.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-brand-navy/40">
            Bạn chưa đăng tin nào. Bấm &ldquo;+ Đăng tin mới&rdquo; để bắt đầu.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-brand-navy/40">
                  <th className="pb-2 font-semibold">Tiêu đề</th>
                  <th className="pb-2 font-semibold">Gói</th>
                  <th className="pb-2 font-semibold">Trạng thái</th>
                  <th className="pb-2 font-semibold">Lượt xem</th>
                  <th className="pb-2 font-semibold">Ứng viên</th>
                  <th className="pb-2 font-semibold">Hết hạn</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const status = STATUS_LABEL[job.status] ?? STATUS_LABEL.pending;
                  return (
                    <tr key={job.id} className="border-t border-black/5">
                      <td className="py-2.5 pr-3 font-semibold text-brand-navy">{job.title}</td>
                      <td className="py-2.5 pr-3 text-brand-navy/60">{TIER_LABEL[job.tier] ?? job.tier}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-brand-navy/60">{job.view_count}</td>
                      <td className="py-2.5 pr-3 font-mono text-brand-navy/60">{job.apply_count}</td>
                      <td className="py-2.5 text-brand-navy/45">
                        {job.expires_at ? new Date(job.expires_at).toLocaleDateString("vi-VN") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
