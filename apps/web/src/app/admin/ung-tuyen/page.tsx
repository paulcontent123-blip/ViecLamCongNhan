import Link from "next/link";
import {
  getAdminApplications,
  getApplicationStatusCounts,
  ADMIN_PAGE_SIZE,
} from "@/lib/admin";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  isApplicationStatus,
  type ApplicationStatus,
} from "@/lib/application-status";
import { ROUTES } from "@/lib/routes";
import { buildQuery } from "@/lib/url";
import { StatusPill } from "@/components/admin/StatusPill";
import { AdminApplicationStatusSelect } from "@/components/admin/ApplicationStatusSelect";
import { AdminPagination } from "@/components/admin/AdminPagination";

const APPLICATION_STATUS_META: Record<ApplicationStatus, { tone: "amber" | "green" | "gray" | "red" | "blue" }> = {
  new: { tone: "gray" },
  viewed: { tone: "blue" },
  contacted: { tone: "amber" },
  rejected: { tone: "red" },
  hired: { tone: "green" },
};

const CANDIDATE_STATUS_LABEL: Record<string, string> = {
  new: "Đang tìm việc",
  viewed: "Đã xem",
  contacted: "Đã liên hệ",
  rejected: "Từ chối",
  hired: "Đã có việc",
  inactive: "Ngừng hoạt động",
};

function toSp(searchParams: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(searchParams)) out[key] = Array.isArray(value) ? value[0] : value;
  return out;
}

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = toSp(await searchParams);
  const status = sp.status && isApplicationStatus(sp.status) ? sp.status : undefined;
  const currentPage = Math.max(1, sp.page ? Number(sp.page) || 1 : 1);

  const [{ applications, total }, counts] = await Promise.all([
    getAdminApplications({
      status,
      q: sp.q,
      limit: ADMIN_PAGE_SIZE,
      offset: (currentPage - 1) * ADMIN_PAGE_SIZE,
    }),
    getApplicationStatusCounts(),
  ]);
  const totalAll = APPLICATION_STATUSES.reduce((sum, key) => sum + counts[key], 0);
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  const tabs: { key: ApplicationStatus | undefined; label: string; count: number }[] = [
    { key: undefined, label: "Tất cả", count: totalAll },
    ...APPLICATION_STATUSES.map((key) => ({
      key,
      label: APPLICATION_STATUS_LABEL[key],
      count: counts[key],
    })),
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[16px] font-extrabold text-brand-navy">📨 Đơn ứng tuyển</h1>
          <p className="mt-1 text-[12px] text-brand-navy/45">
            Trạng thái của ứng viên đối với từng tin tuyển dụng.
          </p>
        </div>
        <form action={ROUTES.adminApplications} method="get" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Tìm tên ứng viên / tin…"
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

      <div className="mb-4 rounded-xl border border-brand-orange/15 bg-gradient-to-br from-brand-orange-light to-transparent px-4 py-3 text-[12.5px] text-brand-navy/60">
        <strong className="text-brand-navy">Lưu ý:</strong> “Đã tuyển” hoặc “Từ chối” ở đây là trạng thái của đơn
        ứng tuyển vào từng tin. Hồ sơ ứng viên có đơn sẽ được đồng bộ trạng thái tổng hợp sang Database ứng viên;
        hồ sơ không có đơn vẫn do Admin quản lý riêng.
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab.key === status;
          return (
            <Link
              key={tab.label}
              href={`${ROUTES.adminApplications}${buildQuery(sp, { status: tab.key })}`}
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                active ? "bg-brand-orange text-white" : "bg-white text-brand-navy/60 hover:bg-black/5"
              }`}
            >
              {tab.label} ({tab.count.toLocaleString("vi-VN")})
            </Link>
          );
        })}
      </div>

      {applications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
          Không có đơn ứng tuyển nào phù hợp.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/5 text-[11px] uppercase tracking-wide text-brand-navy/40">
                <th className="px-4 py-3 font-semibold">Ứng viên</th>
                <th className="px-4 py-3 font-semibold">Tin tuyển dụng</th>
                <th className="px-4 py-3 font-semibold">Nhà tuyển dụng</th>
                <th className="px-4 py-3 font-semibold">Trạng thái đơn</th>
                <th className="px-4 py-3 font-semibold">Ngày ứng tuyển</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => {
                const candidate = application.candidates;
                const job = application.jobs;
                const applicationStatus = isApplicationStatus(application.status)
                  ? application.status
                  : "new";
                const statusMeta = APPLICATION_STATUS_META[applicationStatus];

                return (
                  <tr key={application.id} className="border-t border-black/5 align-top">
                    <td className="px-4 py-3">
                      <div className="font-bold text-brand-navy">{candidate?.full_name ?? "Ứng viên"}</div>
                      <div className="text-[11px] text-brand-navy/45">
                        📞 {candidate?.phone ?? "‑"}
                        {candidate?.zalo && <> · Zalo: {candidate.zalo}</>}
                      </div>
                      <div className="mt-1 text-[11px] text-brand-navy/40">
                        Hồ sơ: {CANDIDATE_STATUS_LABEL[candidate?.status ?? ""] ?? "Chưa xác định"}
                      </div>
                    </td>
                    <td className="max-w-[250px] px-4 py-3">
                      <div className="font-semibold text-brand-navy">{job?.title ?? "Tin đã bị xoá"}</div>
                      {job?.slug && <div className="mt-0.5 truncate text-[11px] text-brand-navy/40">/{job.slug}</div>}
                    </td>
                    <td className="px-4 py-3 text-brand-navy/60">{job?.employers?.company_name ?? "‑"}</td>
                    <td className="px-4 py-3">
                      <StatusPill label={APPLICATION_STATUS_LABEL[applicationStatus]} tone={statusMeta.tone} />
                      <div className="mt-1 text-[11px] text-brand-navy/35">
                        {application.updated_at !== application.created_at
                          ? `Cập nhật ${new Date(application.updated_at).toLocaleString("vi-VN")}`
                          : "Chưa cập nhật"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-brand-navy/45">
                      {new Date(application.created_at).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3">
                      <AdminApplicationStatusSelect
                        applicationId={application.id}
                        currentStatus={applicationStatus}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2 text-right text-[11.5px] text-brand-navy/40">
        Hiển thị {applications.length}/{total.toLocaleString("vi-VN")} đơn ứng tuyển
      </div>

      <AdminPagination baseHref={ROUTES.adminApplications} currentPage={currentPage} totalPages={totalPages} sp={sp} />
    </div>
  );
}
