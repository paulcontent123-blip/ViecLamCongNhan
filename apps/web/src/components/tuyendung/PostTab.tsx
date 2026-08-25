import { PostJobForm } from "@/components/ntd/PostJobForm";
import { PackageCtaButton } from "@/components/tuyendung/PackageCtaButton";
import { ACCOUNT_TIERS, type AccountTier } from "@/lib/account-tiers";
import { ROUTES } from "@/lib/routes";

export function PostTab({
  loggedIn,
  companyName,
  verified,
  accountTier = "free",
  postedToday = 0,
}: {
  loggedIn: boolean;
  companyName?: string | null;
  verified?: boolean;
  accountTier?: AccountTier;
  postedToday?: number;
}) {
  if (loggedIn) {
    return (
      <div>
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-700">
          Đang đăng nhập với tư cách <strong>{companyName}</strong>.
        </div>
        <div className="mb-4 text-[15px] font-extrabold text-brand-navy">📋 Đăng bài tuyển dụng mới</div>
        <PostJobForm
          verified={verified}
          accountTier={accountTier}
          dailyPostLimit={ACCOUNT_TIERS[accountTier].dailyPostLimit}
          postedToday={postedToday}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-brand-orange/30 bg-brand-orange-light p-8 text-center">
      <div className="text-[32px]">🔒</div>
      <div className="mt-2 text-[15px] font-bold text-brand-navy">Cần có tài khoản Nhà tuyển dụng để đăng tin</div>
      <p className="mx-auto mt-2 max-w-md text-[13px] text-brand-navy/55">
        Tạo tài khoản miễn phí trong 30 giây — không cần thẻ, không cần thanh toán trước.
        Đăng tin đầu tiên ngay sau khi đăng ký.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <PackageCtaButton
          loggedIn={false}
          href={ROUTES.ntdDashboardPostJob}
          label="Tạo tài khoản miễn phí →"
          className="rounded-xl bg-brand-orange px-6 py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105"
        />
      </div>
    </div>
  );
}
