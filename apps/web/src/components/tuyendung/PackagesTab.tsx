import { ROUTES } from "@/lib/routes";
import { ACCOUNT_TIERS } from "@/lib/account-tiers";
import { JOB_ADDONS } from "@/lib/packages";
import { PackageCtaButton } from "@/components/tuyendung/PackageCtaButton";

const featureRowClass: Record<"ok" | "no" | "plus", string> = {
  ok: "text-brand-navy/70",
  no: "text-brand-navy/25 line-through",
  plus: "text-brand-orange font-semibold",
};

const packages = [
  {
    tier: "free" as const,
    name: "🎉 Free",
    price: "0đ",
    per: `Mãi mãi · ${ACCOUNT_TIERS.free.dailyPostLimit} tin/ngày`,
    borderClass: "border-emerald-400",
    badge: { text: "MIỄN PHÍ", className: "bg-emerald-500" },
    features: [
      { text: "Có tài khoản là đăng được ngay", type: "ok" as const },
      { text: `${ACCOUNT_TIERS.free.dailyPostLimit} tin tuyển dụng/ngày`, type: "ok" as const },
      { text: `Hiển thị ${ACCOUNT_TIERS.free.jobDurationDays} ngày/tin`, type: "ok" as const },
      { text: "Hiển thị profile công ty trong tìm kiếm", type: "no" as const },
      { text: "Xem hồ sơ ứng viên từ DB", type: "no" as const },
      { text: "Hỗ trợ matching ứng viên", type: "no" as const },
    ],
    ctaLabel: "Tạo tài khoản →",
    ctaClass: "bg-emerald-500 text-white hover:brightness-105",
  },
  {
    tier: "basic" as const,
    name: "📋 Basic",
    price: `${(ACCOUNT_TIERS.basic.priceVnd / 1000).toLocaleString("vi-VN")}K`,
    per: `/tháng · ${ACCOUNT_TIERS.basic.dailyPostLimit} tin/ngày`,
    borderClass: "border-black/10",
    badge: null,
    features: [
      { text: `${ACCOUNT_TIERS.basic.dailyPostLimit} tin tuyển dụng/ngày`, type: "ok" as const },
      { text: `Hiển thị ${ACCOUNT_TIERS.basic.jobDurationDays} ngày/tin`, type: "ok" as const },
      { text: "Hiển thị profile công ty trong tìm kiếm/giới thiệu", type: "ok" as const },
      { text: `Xem ${ACCOUNT_TIERS.basic.candidateViewLimit} hồ sơ ứng viên/tháng`, type: "ok" as const },
      { text: "Hiển thị profile công ty ngoài trang chủ", type: "no" as const },
      { text: "Hỗ trợ matching ứng viên", type: "no" as const },
    ],
    ctaLabel: "Nâng cấp Basic",
    ctaClass: "border border-brand-orange/30 bg-brand-orange-light text-brand-orange hover:bg-brand-orange/15",
  },
  {
    tier: "premium" as const,
    name: "⭐ Premium",
    price: `${(ACCOUNT_TIERS.premium.priceVnd / 1000).toLocaleString("vi-VN")}K`,
    per: `/tháng · ${ACCOUNT_TIERS.premium.dailyPostLimit} tin/ngày`,
    borderClass: "border-2 border-brand-orange",
    badge: { text: "✦ PHỔ BIẾN NHẤT", className: "bg-brand-orange" },
    features: [
      { text: `${ACCOUNT_TIERS.premium.dailyPostLimit} tin tuyển dụng/ngày`, type: "ok" as const },
      { text: `Hiển thị ${ACCOUNT_TIERS.premium.jobDurationDays} ngày/tin`, type: "ok" as const },
      { text: "Hiển thị profile công ty ngoài trang chủ", type: "ok" as const },
      { text: `Xem ${ACCOUNT_TIERS.premium.candidateViewLimit} hồ sơ ứng viên/tháng`, type: "plus" as const },
      { text: "Hỗ trợ matching ứng viên phù hợp", type: "plus" as const },
    ],
    ctaLabel: "Nâng cấp Premium ★",
    ctaClass: "bg-brand-orange text-white hover:brightness-105",
  },
  {
    tier: "campaign" as const,
    name: "🏆 Chiến dịch",
    price: `${(JOB_ADDONS.campaign.priceVnd / 1_000_000).toLocaleString("vi-VN")}M`,
    per: `/tin · ${JOB_ADDONS.campaign.durationDays} ngày`,
    borderClass: "border-black/10",
    badge: null,
    features: [
      { text: "Mua thêm riêng cho 1 tin cụ thể", type: "ok" as const },
      { text: "Trang campaign riêng nổi bật", type: "ok" as const },
      { text: "Banner homepage + top danh sách", type: "ok" as const },
      { text: `${JOB_ADDONS.campaign.durationDays} ngày hiển thị`, type: "ok" as const },
      { text: "Áp dụng cho mọi gói tài khoản", type: "plus" as const },
    ],
    ctaLabel: "Đăng tin + Chiến dịch",
    ctaClass: "border border-brand-orange/30 bg-brand-orange-light text-brand-orange hover:bg-brand-orange/15",
  },
];

export function PackagesTab({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div>
      <p className="mb-5 text-[13px] text-brand-navy/50">
        Gói <strong className="text-emerald-600">Free</strong> không cần thanh toán ‑ chỉ cần tạo tài khoản.{" "}
        <strong>Basic</strong> và <strong>Premium</strong> là thuê bao theo tháng, áp dụng cho toàn bộ tài
        khoản (số tin/ngày, hiển thị profile công ty, xem hồ sơ ứng viên). Gói{" "}
        <strong>Chiến dịch</strong> là mua thêm riêng cho từng tin, độc lập với gói tài khoản.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
        {packages.map((pkg) => (
          <div key={pkg.tier} className={`relative flex h-full flex-col rounded-2xl border bg-white p-4 ${pkg.borderClass}`}>
            {pkg.badge && (
              <div
                className={`absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[9px] font-bold text-white ${pkg.badge.className}`}
              >
                {pkg.badge.text}
              </div>
            )}
            <div className="text-[13px] font-bold text-brand-navy">{pkg.name}</div>
            <div className="mt-1 font-mono text-[22px] font-extrabold text-brand-orange">{pkg.price}</div>
            <div className="mb-3 text-[11px] text-brand-navy/45">{pkg.per}</div>
            {/* flex-1 đẩy toàn bộ nút CTA bên dưới xuống cùng 1 hàng đáy, bất kể thẻ
                nào có nhiều/ít dòng quyền lợi hơn ‑ tránh nút lệch hàng như trước. */}
            <div className="mb-4 flex-1 space-y-1.5">
              {pkg.features.map((f) => (
                <div key={f.text} className={`text-[12px] ${featureRowClass[f.type]}`}>
                  {f.type === "no" ? "✕" : "✓"} {f.text}
                </div>
              ))}
            </div>
            <PackageCtaButton
              loggedIn={loggedIn}
              href={pkg.tier === "free" || pkg.tier === "campaign" ? ROUTES.ntdDashboardPostJob : ROUTES.ntdDashboardOrders}
              label={pkg.ctaLabel}
              className={`w-full rounded-lg py-2.5 text-center text-[12.5px] font-bold transition ${pkg.ctaClass}`}
            />
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-brand-orange/20 bg-gradient-to-br from-brand-orange-light to-white p-5">
        <div className="mb-1.5 text-[13.5px] font-bold text-brand-navy">
          📂 Database ứng viên ‑ bảo mật, chỉ dùng nội bộ
        </div>
        <div className="text-[13px] leading-relaxed text-brand-navy/55">
          Hồ sơ ứng viên <strong>không được public</strong> ra ngoài. Nhà tuyển dụng gói Basic/Premium xem hồ
          sơ phù hợp theo hạn mức/tháng qua dashboard nội bộ ‑ không có trang tra cứu công khai.
        </div>
      </div>
    </div>
  );
}
