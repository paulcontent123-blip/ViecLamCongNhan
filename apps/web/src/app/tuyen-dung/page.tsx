import Link from "next/link";
import { getEmployerSession } from "@/lib/employer-auth";
import { isEmployerVerified, getEmployerAccountTier, countJobsPostedToday } from "@/lib/employer";
import { ROUTES } from "@/lib/routes";
import { PostTab } from "@/components/tuyendung/PostTab";
import { PackagesTab } from "@/components/tuyendung/PackagesTab";
import { BlastTab } from "@/components/tuyendung/BlastTab";
import { VerificationBanner } from "@/components/ntd/VerificationBanner";
import { getHomeStats } from "@/lib/home-stats";

const steps = ["Tạo tài khoản Nhà tuyển dụng", "Điền thông tin đơn vị", "Đăng bài tuyển dụng", "Nhận ứng viên & tuyển"];

const tabs = [
  { id: "dang", href: `${ROUTES.tuyenDung}?tab=dang`, icon: "📋", label: "Đăng bài tuyển dụng" },
  { id: "goi", href: `${ROUTES.tuyenDung}?tab=goi`, icon: "💼", label: "Gói đăng tin" },
  { id: "blast", href: `${ROUTES.tuyenDung}?tab=blast`, icon: "📲", label: "Blast SMS / Zalo" },
];

export default async function TuyenDungPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const activeTab = sp.tab === "goi" || sp.tab === "blast" ? sp.tab : "dang";

  const homeStats = await getHomeStats();
  const stats = [
    { value: homeStats.candidates.toLocaleString("vi-VN"), label: "Ứng viên trong database" },
    { value: String(homeStats.kcn), label: "KCN phủ sóng toàn quốc" },
    { value: "2h", label: "Tin được duyệt trong vòng" },
    { value: "Free", label: "Đăng tin miễn phí 1 tin/ngày" },
  ];

  const session = await getEmployerSession();
  const loggedIn = Boolean(session);
  const verified = session ? await isEmployerVerified(session.employerId) : false;
  const accountTier = session ? await getEmployerAccountTier(session.employerId) : "free";
  const postedToday = session ? await countJobsPostedToday(session.employerId) : 0;

  return (
    <div className="px-4 pb-20 pt-10 sm:px-8 lg:px-[52px]">
      <div className="mx-auto max-w-6xl">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">Nhà Tuyển Dụng</div>
        <h1 className="mt-2 max-w-2xl text-[26px] font-extrabold text-brand-navy sm:text-[30px]">
          Tuyển công nhân <em className="text-brand-orange not-italic">nhanh &amp; đúng người</em>
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-brand-navy/55">
          ViecLamCongNhan.com kết nối nhà tuyển dụng với{" "}
          <strong>{homeStats.candidates.toLocaleString("vi-VN")} công nhân</strong> đang tìm việc tại{" "}
          {homeStats.kcn} KCN toàn quốc. Đăng tin miễn phí hoặc chọn gói nâng cao để tiếp cận nhanh hơn.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-black/5 bg-white p-3.5 text-center">
              <div className="font-mono text-[20px] font-extrabold text-brand-orange">{s.value}</div>
              <div className="mt-0.5 text-[11px] text-brand-navy/45">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-brand-orange/20 bg-brand-orange-light p-4 sm:p-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-brand-orange">
            Quy trình đăng tin
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {steps.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-orange text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="text-[12.5px] text-brand-navy">{step}</span>
                </div>
                {i < steps.length - 1 && <span className="text-brand-navy/30">→</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-2 border-b border-black/5">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              className={`rounded-t-lg px-4 py-2.5 text-[13.5px] font-bold transition ${
                activeTab === t.id
                  ? "border-b-2 border-brand-orange text-brand-orange"
                  : "text-brand-navy/50 hover:text-brand-navy"
              }`}
            >
              {t.icon} {t.label}
            </Link>
          ))}
        </div>

        <div className="mt-6">
          {loggedIn && <VerificationBanner verified={verified} />}
          {activeTab === "dang" && (
            <PostTab
              loggedIn={loggedIn}
              companyName={session?.companyName}
              verified={verified}
              accountTier={accountTier}
              postedToday={postedToday}
            />
          )}
          {activeTab === "goi" && <PackagesTab loggedIn={loggedIn} />}
          {activeTab === "blast" && <BlastTab loggedIn={loggedIn} verified={verified} />}
        </div>
      </div>
    </div>
  );
}
