// Trang giới thiệu + đăng ký của một cổng đối tác. Không có hook nên dùng được từ trang máy chủ; trang gọi truyền
// vào `loggedIn` (đã đọc cookie phiên) và `form` (form đăng ký của riêng cổng).

import Link from "next/link";
import { PORTALS, type PortalKey } from "@/components/doitac/PortalChrome";

export function ProviderLanding({
  portal,
  kicker,
  kickerClass,
  titleLead,
  titleAccent,
  accentClass,
  buttonClass,
  icon,
  intro,
  notices,
  publicHref,
  publicLabel,
  loggedIn,
  dashboardHref,
  loggedInNote,
  form,
}: {
  portal: PortalKey;
  kicker: string;
  /** Màu chữ của dòng nhỏ phía trên tiêu đề, ví dụ "text-brand-orange". */
  kickerClass: string;
  titleLead: string;
  titleAccent: string;
  /** Màu chữ nhấn của dòng tiêu đề thứ hai và liên kết. */
  accentClass: string;
  /** Nền nút "Vào khu quản lý". */
  buttonClass: string;
  icon: string;
  intro: string;
  /** Các khung lưu ý dưới danh sách tính năng; truyền sẵn nội dung đã dựng. */
  notices: { tone: "amber" | "plain"; body: React.ReactNode }[];
  publicHref: string;
  publicLabel: string;
  loggedIn: boolean;
  dashboardHref: string;
  loggedInNote: string;
  form: React.ReactNode;
}) {
  return (
    <div className="bg-[#f6f7f9] px-4 py-12 sm:px-8 sm:py-16 lg:px-[52px]">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_minmax(380px,480px)]">
        <div>
          <div className={`text-[11px] font-bold uppercase tracking-widest ${kickerClass}`}>{kicker}</div>
          <h1 className="mt-3 text-[30px] font-extrabold leading-tight text-brand-navy sm:text-[40px]">
            {titleLead}
            <br />
            <em className={`not-italic ${accentClass}`}>{titleAccent}</em>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-brand-navy/60">{intro}</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {PORTALS[portal].nav
              .filter((item) => item.key !== "dashboard")
              .map((item) => (
                <div key={item.key} className="rounded-xl border border-black/5 bg-white p-4">
                  <div className="text-[20px]" aria-hidden="true">
                    {item.icon}
                  </div>
                  <div className="mt-2 text-[13.5px] font-extrabold text-brand-navy">{item.label}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-brand-navy/55">{item.desc}</p>
                </div>
              ))}
          </div>

          {notices.map((notice, index) => (
            <div
              key={index}
              className={`mt-4 rounded-xl border px-4 py-3 text-[12.5px] leading-relaxed ${
                notice.tone === "amber"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-black/5 bg-white text-brand-navy/60"
              }`}
            >
              {notice.body}
            </div>
          ))}

          <p className="mt-5 text-[13px] text-brand-navy/50">
            Muốn xem công nhân đang thấy gì?{" "}
            <Link href={publicHref} className={`font-bold ${accentClass}`}>
              {publicLabel} →
            </Link>
          </p>
        </div>

        <div className="lg:sticky lg:top-[76px] lg:self-start">
          {loggedIn ? (
            <div className="rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm">
              <div className="text-[32px]">{icon}</div>
              <h2 className="mt-2 text-[16px] font-extrabold text-brand-navy">Bạn đang đăng nhập</h2>
              <p className="mt-1 text-[12.5px] text-brand-navy/50">{loggedInNote}</p>
              <Link
                href={dashboardHref}
                className={`mt-5 inline-block rounded-xl px-6 py-2.5 text-[13px] font-bold transition hover:brightness-110 ${buttonClass}`}
              >
                Vào khu quản lý →
              </Link>
            </div>
          ) : (
            form
          )}
        </div>
      </div>
    </div>
  );
}
