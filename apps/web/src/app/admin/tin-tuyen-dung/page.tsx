import Link from "next/link";
import { getAdminJobs, getJobStatusCounts, ADMIN_PAGE_SIZE, isJobStatus, type AdminJobStatus } from "@/lib/admin";
import { provinceName } from "@/lib/provinces";
import { industryLabel } from "@/lib/industries";
import { ROUTES } from "@/lib/routes";
import { buildQuery } from "@/lib/url";
import { JobActions } from "@/components/admin/JobActions";
import { StatusPill } from "@/components/admin/StatusPill";
import { AdminPagination } from "@/components/admin/AdminPagination";

const STATUS_LABEL: Record<AdminJobStatus, { label: string; tone: "amber" | "green" | "gray" | "red" }> = {
  pending: { label: "Chờ duyệt", tone: "amber" },
  approved: { label: "Đã duyệt", tone: "green" },
  closed: { label: "Đã ẩn", tone: "gray" },
  expired: { label: "Hết hạn", tone: "gray" },
};

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  premium: "Premium",
  campaign: "Chiến dịch",
};

function toSp(searchParams: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = toSp(await searchParams);
  const status = sp.status && isJobStatus(sp.status) ? sp.status : undefined;
  const currentPage = Math.max(1, sp.page ? Number(sp.page) || 1 : 1);

  const [{ jobs, total }, counts] = await Promise.all([
    getAdminJobs({ status, q: sp.q, limit: ADMIN_PAGE_SIZE, offset: (currentPage - 1) * ADMIN_PAGE_SIZE }),
    getJobStatusCounts(),
  ]);

  const totalAll = counts.pending + counts.approved + counts.closed + counts.expired;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  const tabs: { key: AdminJobStatus | undefined; label: string; count: number }[] = [
    { key: undefined, label: "Tất cả", count: totalAll },
    { key: "pending", label: "Chờ duyệt", count: counts.pending },
    { key: "approved", label: "Đã duyệt", count: counts.approved },
    { key: "closed", label: "Đã ẩn", count: counts.closed },
    { key: "expired", label: "Hết hạn", count: counts.expired },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[16px] font-extrabold text-brand-navy">📋 Tin tuyển dụng</h1>
        <form action={ROUTES.adminJobs} method="get" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Tìm theo tiêu đề tin…"
            className="w-56 rounded-lg border border-black/10 px-3 py-2 text-[12.5px] outline-none focus:border-brand-orange"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-navy px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:brightness-110"
          >
            Tìm
          </button>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab.key === status;
          return (
            <Link
              key={tab.label}
              href={`${ROUTES.adminJobs}${buildQuery(sp, { status: tab.key, q: sp.q })}`}
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                active ? "bg-brand-orange text-white" : "bg-white text-brand-navy/60 hover:bg-black/5"
              }`}
            >
              {tab.label} ({tab.count.toLocaleString("vi-VN")})
            </Link>
          );
        })}
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
          Không có tin tuyển dụng nào phù hợp.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/5 text-[11px] uppercase tracking-wide text-brand-navy/40">
                <th className="px-4 py-3 font-semibold">Tiêu đề</th>
                <th className="px-4 py-3 font-semibold">Công ty</th>
                <th className="px-4 py-3 font-semibold">Ngành / Tỉnh</th>
                <th className="px-4 py-3 font-semibold">Gói</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold">Ngày đăng</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const st = STATUS_LABEL[job.status as AdminJobStatus] ?? STATUS_LABEL.pending;
                return (
                  <tr key={job.id} className="border-t border-black/5">
                    <td className="max-w-[220px] px-4 py-3">
                      <div className="truncate font-bold text-brand-navy">{job.title}</div>
                    </td>
                    <td className="px-4 py-3 text-brand-navy/60">{job.employers?.company_name ?? "‑"}</td>
                    <td className="px-4 py-3 text-brand-navy/60">
                      {industryLabel(job.industry)} · {provinceName(job.province_code)}
                    </td>
                    <td className="px-4 py-3 text-brand-navy/60">{TIER_LABEL[job.tier] ?? job.tier}</td>
                    <td className="px-4 py-3">
                      <StatusPill label={st.label} tone={st.tone} />
                    </td>
                    <td className="px-4 py-3 text-[12px] text-brand-navy/40">
                      {new Date(job.created_at).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-4 py-3">
                      <JobActions jobId={job.id} status={job.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination baseHref={ROUTES.adminJobs} currentPage={currentPage} totalPages={totalPages} sp={sp} />
    </div>
  );
}
