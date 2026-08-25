import Link from "next/link";
import {
  getAdminOrders,
  getAdminOrderStats,
  ADMIN_PAGE_SIZE,
  isOrderStatus,
  ORDER_TYPE_LABEL,
  type AdminOrderStatus,
} from "@/lib/admin";
import { ROUTES } from "@/lib/routes";
import { buildQuery } from "@/lib/url";
import { isPaymentMethod, PAYMENT_METHOD_META } from "@/lib/payment-method";
import { StatusPill } from "@/components/admin/StatusPill";
import { OrderStatusActions } from "@/components/admin/OrderStatusActions";
import { AdminPagination } from "@/components/admin/AdminPagination";

// NTD đã bấm "Xác nhận thanh toán" ở modal thì đơn mới được tạo (xem
// BuyPackageButton.tsx) — nên "pending" ở đây luôn có nghĩa "NTD đã tự khai đã
// thanh toán, chờ Admin xác minh", không phải "chưa làm gì".
const STATUS_LABEL: Record<AdminOrderStatus, { label: string; tone: "amber" | "green" | "gray" | "blue" }> = {
  pending: { label: "Đã thanh toán — chờ xác nhận", tone: "amber" },
  paid: { label: "Đã xác nhận", tone: "green" },
  cancelled: { label: "Đã huỷ", tone: "gray" },
  refunded: { label: "Đã hoàn tiền", tone: "blue" },
};

function toSp(searchParams: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams)) out[k] = Array.isArray(v) ? v[0] : v;
  return out;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = toSp(await searchParams);
  const status = sp.status && isOrderStatus(sp.status) ? sp.status : undefined;
  const currentPage = Math.max(1, sp.page ? Number(sp.page) || 1 : 1);

  const [{ orders, total }, stats] = await Promise.all([
    getAdminOrders({
      status,
      q: sp.q,
      limit: ADMIN_PAGE_SIZE,
      offset: (currentPage - 1) * ADMIN_PAGE_SIZE,
    }),
    getAdminOrderStats(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  const revenueChangePct =
    stats.revenueLastMonthVnd > 0
      ? Math.round(((stats.revenueThisMonthVnd - stats.revenueLastMonthVnd) / stats.revenueLastMonthVnd) * 100)
      : null;

  const tabs: { key: AdminOrderStatus | undefined; label: string }[] = [
    { key: undefined, label: "Tất cả" },
    { key: "pending", label: "Chờ xác nhận" },
    { key: "paid", label: "Đã thanh toán" },
    { key: "cancelled", label: "Đã huỷ" },
    { key: "refunded", label: "Hoàn tiền" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[16px] font-extrabold text-brand-navy">💳 Đơn hàng &amp; Thanh toán</h1>
        <form action={ROUTES.adminOrders} method="get" className="flex items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Tìm theo tên NTD, mã đơn, gói..."
            className="w-64 rounded-lg border border-black/10 px-3 py-2 text-[12.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-orange px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:brightness-105"
          >
            Tìm
          </button>
        </form>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-black/5 bg-white p-4">
          <div className="font-mono text-[20px] font-extrabold text-brand-navy">
            {(stats.revenueThisMonthVnd / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}M
          </div>
          <div className="mt-0.5 text-[11.5px] text-brand-navy/45">Doanh thu tháng này</div>
          {revenueChangePct !== null && (
            <div className={`mt-1 text-[11.5px] font-bold ${revenueChangePct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {revenueChangePct >= 0 ? "↑" : "↓"} {Math.abs(revenueChangePct)}% so tháng trước
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-4">
          <div className="font-mono text-[20px] font-extrabold text-brand-navy">{stats.ordersThisMonthCount}</div>
          <div className="mt-0.5 text-[11.5px] text-brand-navy/45">Đơn hàng tháng này</div>
          <div className="mt-1 text-[11.5px] font-bold text-brand-navy/50">+{stats.ordersLast7DaysCount} tuần này</div>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-4">
          <div className="font-mono text-[20px] font-extrabold text-brand-orange">{stats.pendingCount}</div>
          <div className="mt-0.5 text-[11.5px] text-brand-navy/45">Chờ xác nhận</div>
          {stats.pendingCount > 0 && <div className="mt-1 text-[11.5px] font-bold text-brand-orange">Cần xử lý</div>}
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-4">
          <div className="font-mono text-[20px] font-extrabold text-brand-navy">{stats.refundedThisMonthCount}</div>
          <div className="mt-0.5 text-[11.5px] text-brand-navy/45">Đơn hoàn tiền</div>
          <div className="mt-1 text-[11.5px] font-bold text-brand-navy/50">Tháng này</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab.key === status;
          return (
            <Link
              key={tab.label}
              href={`${ROUTES.adminOrders}${buildQuery(sp, { status: tab.key })}`}
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                active ? "bg-brand-orange text-white" : "bg-white text-brand-navy/60 hover:bg-black/5"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
          Không có đơn hàng nào phù hợp.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/5 text-[11px] uppercase tracking-wide text-brand-navy/40">
                <th className="px-4 py-3 font-semibold">Đơn hàng</th>
                <th className="px-4 py-3 font-semibold">Nhà tuyển dụng</th>
                <th className="px-4 py-3 font-semibold">Loại / Gói</th>
                <th className="px-4 py-3 font-semibold">Số tiền</th>
                <th className="px-4 py-3 font-semibold">Thanh toán</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const st = STATUS_LABEL[o.status as AdminOrderStatus] ?? STATUS_LABEL.pending;
                return (
                  <tr key={o.id} className="border-t border-black/5">
                    <td className="px-4 py-3">
                      <div className="font-mono text-[12px] font-bold text-brand-navy">
                        DH{o.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div className="text-[11px] text-brand-navy/40">
                        {new Date(o.created_at).toLocaleString("vi-VN")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brand-navy/60">{o.employers?.company_name ?? "—"}</td>
                    <td className="px-4 py-3 text-brand-navy/60">
                      {o.order_type ? ORDER_TYPE_LABEL[o.order_type] ?? o.order_type : "—"}
                      {o.tier && <span className="text-brand-navy/40"> · {o.tier}</span>}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-brand-orange">
                      {o.amount.toLocaleString("vi-VN")}đ
                    </td>
                    <td className="px-4 py-3 text-brand-navy/60">
                      {o.payment_method && isPaymentMethod(o.payment_method)
                        ? `${PAYMENT_METHOD_META[o.payment_method].icon} ${PAYMENT_METHOD_META[o.payment_method].label}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill label={st.label} tone={st.tone} />
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusActions order={o} statusLabel={st.label} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination baseHref={ROUTES.adminOrders} currentPage={currentPage} totalPages={totalPages} sp={sp} />
    </div>
  );
}
