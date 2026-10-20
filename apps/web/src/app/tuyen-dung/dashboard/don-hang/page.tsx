import Link from "next/link";
import { getEmployerSession } from "@/lib/employer-auth";
import { getEmployerOrders, getEmployerAccountTier, isEmployerVerified } from "@/lib/employer";
import { ACCOUNT_TIERS, PAID_ACCOUNT_TIERS } from "@/lib/account-tiers";
import { JOB_ADDONS } from "@/lib/packages";
import { PAYMENT_STATE_LABEL, paymentState } from "@/lib/payment";
import { BuyPackageButton } from "@/components/ntd/BuyPackageButton";
import { CampaignPurchaseCard } from "@/components/ntd/CampaignPurchaseCard";

// Trạng thái hiển thị suy ra từ orders.status + việc NTD đã bấm "Tôi đã thanh toán"
// chưa (xem lib/payment.ts): tạo đơn xong mà chưa chuyển tiền vẫn là "Chưa thanh toán".
const ORDER_STATE_CLASS: Record<string, string> = {
  unpaid: "bg-black/5 text-brand-navy/50",
  awaiting: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-black/5 text-brand-navy/50",
  refunded: "bg-sky-50 text-sky-700",
};

const ORDER_TYPE_LABEL: Record<string, string> = {
  job_post: "Mua thêm (Chiến dịch)",
  account_subscription: "Thuê bao tài khoản",
  sms_blast: "Blast SMS/Zalo",
  rpo_service: "Dịch vụ RPO",
  banner: "Banner quảng cáo",
};

const TIER_PERK_ROWS: Record<(typeof PAID_ACCOUNT_TIERS)[number], string[]> = {
  basic: [
    `${ACCOUNT_TIERS.basic.dailyPostLimit} tin đăng/ngày`,
    "Hiển thị profile công ty trong tìm kiếm/giới thiệu",
    `Xem ${ACCOUNT_TIERS.basic.candidateViewLimit} hồ sơ ứng viên/tháng`,
  ],
  premium: [
    `${ACCOUNT_TIERS.premium.dailyPostLimit} tin đăng/ngày`,
    "Hiển thị profile công ty ngoài trang chủ",
    `Xem ${ACCOUNT_TIERS.premium.candidateViewLimit} hồ sơ ứng viên/tháng`,
    "Hỗ trợ matching ứng viên phù hợp",
  ],
};

const CAMPAIGN_ROWS = [
  "Mua thêm riêng cho 1 tin cụ thể",
  "Trang campaign riêng nổi bật",
  "Banner homepage + top danh sách",
  `${JOB_ADDONS.campaign.durationDays} ngày hiển thị`,
];

export default async function EmployerOrdersPage() {
  const session = await getEmployerSession();
  if (!session) return null;

  const [orders, verified, currentTier] = await Promise.all([
    getEmployerOrders(session.employerId),
    isEmployerVerified(session.employerId),
    getEmployerAccountTier(session.employerId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-[15px] font-extrabold text-brand-navy">💳 Nâng cấp gói tài khoản</h2>
        <p className="mb-4 text-[13px] text-brand-navy/50">
          Gói hiện tại: <strong className="text-brand-navy">{ACCOUNT_TIERS[currentTier].label}</strong> ‑ thuê
          bao theo tháng, áp dụng cho toàn bộ tài khoản (số tin/ngày, hiển thị profile công ty, xem hồ sơ ứng
          viên).
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PAID_ACCOUNT_TIERS.map((tier) => {
            const pkg = ACCOUNT_TIERS[tier];
            const highlight = tier === "premium";
            const isCurrent = tier === currentTier;
            return (
              <div
                key={tier}
                className={`relative rounded-2xl border bg-white p-4 ${highlight ? "border-2 border-brand-orange" : "border-black/10"}`}
              >
                {highlight && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-orange px-2.5 py-0.5 text-[9px] font-bold text-white">
                    ✦ PHỔ BIẾN NHẤT
                  </div>
                )}
                <div className="text-[13px] font-bold text-brand-navy">
                  {tier === "premium" ? "⭐" : "📋"} {pkg.label}
                </div>
                <div className="mt-1 font-mono text-[22px] font-extrabold text-brand-orange">
                  {(pkg.priceVnd / 1000).toLocaleString("vi-VN")}K
                </div>
                <div className="mb-3 text-[11px] text-brand-navy/45">/tháng · {pkg.dailyPostLimit} tin/ngày</div>
                <div className="mb-4 space-y-1.5">
                  {TIER_PERK_ROWS[tier].map((row) => (
                    <div key={row} className="text-[12px] text-brand-navy/70">
                      ✓ {row}
                    </div>
                  ))}
                </div>
                {isCurrent ? (
                  <span className="block w-full rounded-lg bg-emerald-50 py-2 text-center text-[12px] font-bold text-emerald-700">
                    ✓ Gói đang dùng
                  </span>
                ) : (
                  <BuyPackageButton
                    tier={tier}
                    label={pkg.label}
                    priceVnd={pkg.priceVnd}
                    highlight={highlight}
                    verified={verified}
                  />
                )}
              </div>
            );
          })}

          <div className="relative rounded-2xl border border-black/10 bg-white p-4">
            <div className="text-[13px] font-bold text-brand-navy">🏆 {JOB_ADDONS.campaign.label}</div>
            <div className="mt-1 font-mono text-[22px] font-extrabold text-brand-orange">
              {(JOB_ADDONS.campaign.priceVnd / 1000).toLocaleString("vi-VN")}K
            </div>
            <div className="mb-3 text-[11px] text-brand-navy/45">/tin · {JOB_ADDONS.campaign.durationDays} ngày</div>
            <div className="mb-4 space-y-1.5">
              {CAMPAIGN_ROWS.map((row) => (
                <div key={row} className="text-[12px] text-brand-navy/70">
                  ✓ {row}
                </div>
              ))}
            </div>
            <CampaignPurchaseCard />
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-extrabold text-brand-navy">📄 Lịch sử đơn hàng</h2>
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
            Bạn chưa có đơn hàng nào.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-black/5 text-[11px] uppercase tracking-wide text-brand-navy/40">
                  <th className="px-4 py-3 font-semibold">Đơn hàng</th>
                  <th className="px-4 py-3 font-semibold">Loại</th>
                  <th className="px-4 py-3 font-semibold">Gói</th>
                  <th className="px-4 py-3 font-semibold">Số tiền</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const state = paymentState(order.status, order.customer_confirmed_at !== null);
                  const payable = order.status === "pending" && order.code;
                  return (
                    <tr key={order.id} className="border-t border-black/5">
                      <td className="px-4 py-3">
                        <div className="font-mono text-[12px] font-semibold text-brand-navy">
                          {order.code ?? `DH${order.id.slice(0, 8).toUpperCase()}`}
                        </div>
                        <div className="text-[11px] text-brand-navy/40">
                          {new Date(order.created_at).toLocaleString("vi-VN")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-brand-navy/60">
                        {order.order_type ? ORDER_TYPE_LABEL[order.order_type] ?? order.order_type : "‑"}
                      </td>
                      <td className="px-4 py-3 text-brand-navy/60">{order.tier ?? "‑"}</td>
                      <td className="px-4 py-3 font-mono font-bold text-brand-orange">
                        {order.amount.toLocaleString("vi-VN")}đ
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ORDER_STATE_CLASS[state]}`}
                        >
                          {PAYMENT_STATE_LABEL[state]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {payable && (
                          <Link
                            href={`/tuyen-dung/thanh-toan/${order.code}`}
                            className="rounded-lg bg-brand-orange-light px-2.5 py-1.5 text-[11.5px] font-bold text-brand-orange transition hover:bg-brand-orange/15"
                          >
                            {order.customer_confirmed_at ? "Xem đơn" : "Thanh toán →"}
                          </Link>
                        )}
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
