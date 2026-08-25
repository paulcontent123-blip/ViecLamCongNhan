import Link from "next/link";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminDashboardStats } from "@/lib/admin";
import { ROUTES } from "@/lib/routes";

function fmtVnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  const stats = await getAdminDashboardStats();

  const totalJobs =
    stats.jobsByStatus.pending + stats.jobsByStatus.approved + stats.jobsByStatus.closed + stats.jobsByStatus.expired;

  const statCards = [
    { n: totalJobs.toLocaleString("vi-VN"), l: "Tổng tin tuyển dụng", d: `${stats.jobsByStatus.approved.toLocaleString("vi-VN")} đang hiển thị` },
    {
      n: stats.totalCandidates.toLocaleString("vi-VN"),
      l: "Hồ sơ ứng viên trong DB",
      d: `${stats.totalApplications.toLocaleString("vi-VN")} đơn ứng tuyển`,
    },
    { n: stats.totalEmployers.toLocaleString("vi-VN"), l: "Nhà tuyển dụng", d: `${stats.unverifiedEmployers} chưa xác minh` },
    { n: fmtVnd(stats.revenueThisMonthVnd), l: "Doanh thu tháng này", d: `${stats.ordersThisMonthCount} đơn hàng tháng này` },
  ];

  return (
    <div>
      <div className="mb-5">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">Quản trị</div>
        <h1 className="mt-1 text-[20px] font-extrabold text-brand-navy">Xin chào, {session?.fullName ?? "Admin"}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.l} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
            <div className="truncate text-[20px] font-extrabold text-brand-navy">{s.n}</div>
            <div className="mt-0.5 text-[11.5px] text-brand-navy/50">{s.l}</div>
            <div className="mt-1.5 text-[11px] font-semibold text-brand-orange">{s.d}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-3 text-[13.5px] font-bold text-brand-navy">⏳ Cần xử lý ngay</div>
          <div className="flex flex-col gap-2">
            <Link
              href={ROUTES.adminJobs}
              className="flex items-center justify-between rounded-lg border border-brand-orange/20 bg-brand-orange-light px-3 py-2.5 text-[12.5px] font-semibold text-brand-navy transition hover:border-brand-orange/40"
            >
              <span>📋 Tin tuyển dụng chờ duyệt</span>
              <strong className="text-brand-orange">{stats.jobsByStatus.pending}</strong>
            </Link>
            <Link
              href={ROUTES.adminEmployers}
              className="flex items-center justify-between rounded-lg border border-brand-orange/20 bg-brand-orange-light px-3 py-2.5 text-[12.5px] font-semibold text-brand-navy transition hover:border-brand-orange/40"
            >
              <span>🏢 Nhà tuyển dụng chưa xác minh</span>
              <strong className="text-brand-orange">{stats.unverifiedEmployers}</strong>
            </Link>
            <Link
              href={ROUTES.adminOrders}
              className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12.5px] font-semibold text-brand-navy transition hover:border-emerald-300"
            >
              <span>💳 Đơn hàng chờ xác nhận</span>
              <strong className="text-emerald-600">{stats.pendingOrdersCount}</strong>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="mb-3 text-[13.5px] font-bold text-brand-navy">⚡ Truy cập nhanh</div>
          <div className="flex flex-col gap-2">
            <Link
              href={ROUTES.adminJobs}
              className="rounded-lg bg-brand-orange-light px-3 py-2.5 text-left text-[12.5px] font-bold text-brand-orange transition hover:brightness-95"
            >
              📋 Duyệt tin tuyển dụng ({stats.jobsByStatus.pending} chờ)
            </Link>
            <Link
              href={ROUTES.adminCandidates}
              className="rounded-lg bg-[#f6f7f9] px-3 py-2.5 text-left text-[12.5px] font-bold text-brand-navy transition hover:bg-black/5"
            >
              👥 Xem ứng viên ({stats.totalCandidates.toLocaleString("vi-VN")})
            </Link>
            <Link
              href={ROUTES.adminApplications}
              className="rounded-lg bg-brand-orange-light px-3 py-2.5 text-left text-[12.5px] font-bold text-brand-orange transition hover:brightness-95"
            >
              📨 Xem đơn ứng tuyển ({stats.totalApplications.toLocaleString("vi-VN")})
            </Link>
            <Link
              href={ROUTES.adminOrders}
              className="rounded-lg bg-[#f6f7f9] px-3 py-2.5 text-left text-[12.5px] font-bold text-brand-navy transition hover:bg-black/5"
            >
              💳 Xử lý đơn hàng chờ xác nhận ({stats.pendingOrdersCount})
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
