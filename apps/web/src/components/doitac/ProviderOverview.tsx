"use client";

// Trang Tổng quan dùng chung cho các cổng đối tác. Mỗi cổng truyền `load` (gom hồ sơ, số liệu, hoạt động gần đây
// từ các route của riêng cổng) và các chữ hiển thị; khung trình bày, xử lý hết phiên và tải lại thì dùng chung.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import { PORTALS, UnverifiedNotice, type PortalKey } from "@/components/doitac/PortalChrome";
import { MobileStateCard } from "@/components/shared/mobileUi";
import { isSessionExpired, messageOf } from "@/components/shared/useMobileList";
import { formatDate } from "@/lib/format-date";

export type OverviewActivity = {
  id: string;
  href: string;
  type: string;
  title: string;
  detail?: string | null;
  label: string;
  tone: "amber" | "green" | "red" | "gray" | "blue";
  createdAt: string | null;
};

export type OverviewData = {
  name: string;
  verified: boolean;
  /** Dòng nhỏ dưới tên đơn vị (gói, hạn mức, email…). */
  subtitle: string;
  /** Bốn số liệu, cùng thứ tự với `statLabels`; null là chưa tải được. */
  stats: (number | null)[];
  /** Tóm tắt bên phải mục "Hoạt động gần đây", ví dụ "12 sản phẩm · 5 yêu cầu". */
  summary: string;
  activity: OverviewActivity[];
  /** Có phần số liệu nào tải hỏng không (hiện nút "Tải lại"). */
  partial: boolean;
  /** Khung lưu ý thêm (ví dụ hạn mức bằng 0). */
  extraNotice?: React.ReactNode;
};

export function ProviderOverview({
  portal,
  loginHref,
  kicker,
  gradient,
  statLabels,
  statClass,
  unverifiedMessage,
  tilesTitle,
  load,
}: {
  portal: PortalKey;
  loginHref: string;
  kicker: string;
  /** Lớp nền chuyển màu của khối đầu trang, ví dụ "from-brand-orange to-brand-orange-2". */
  gradient: string;
  statLabels: [string, string, string, string];
  /** Màu chữ của các số liệu. */
  statClass: string;
  unverifiedMessage: React.ReactNode;
  tilesTitle: string;
  load: () => Promise<OverviewData>;
}) {
  const router = useRouter();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const run = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await load());
    } catch (err) {
      if (isSessionExpired(err)) {
        router.replace(loginHref);
        return;
      }
      setError(messageOf(err, "Chưa tải được dữ liệu."));
    } finally {
      setLoading(false);
    }
    // `load` được tạo mới mỗi lần render ở nơi gọi; chỉ tải lại khi đổi cổng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loginHref]);

  useEffect(() => {
    run();
  }, [run]);

  if (loading && !data) return <MobileStateCard tone="loading" title="Đang tải tài khoản…" />;
  if (error && !data) {
    return <MobileStateCard tone="error" title="Chưa tải được dữ liệu" description={error} onRetry={run} />;
  }
  if (!data) return null;

  return (
    <>
      <div className={`mb-4 rounded-2xl bg-gradient-to-br p-5 text-white sm:p-6 ${gradient}`}>
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">{kicker}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h1 className="text-[20px] font-extrabold">{data.name}</h1>
          <span
            className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${
              data.verified ? "bg-[#DBF7E8] text-[#146C43]" : "bg-amber-100 text-amber-800"
            }`}
          >
            {data.verified ? "Đã xác minh" : "Chưa xác minh"}
          </span>
        </div>
        <p className="mt-1.5 text-[12.5px] text-white/70">{data.subtitle}</p>
      </div>

      {data.partial && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-medium text-amber-800">
          <span>Một số số liệu chưa tải được. Bấm tải lại để thử lần nữa.</span>
          <button type="button" onClick={run} className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-bold text-white">
            Tải lại
          </button>
        </div>
      )}

      {!data.verified && <UnverifiedNotice message={unverifiedMessage} />}
      {data.extraNotice}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statLabels.map((label, index) => {
          const value = data.stats[index];
          return (
            <div key={label} className="rounded-xl border border-black/5 bg-white p-4 text-center">
              <div className={`text-[22px] font-extrabold ${statClass}`}>
                {value === null || value === undefined ? "—" : value.toLocaleString("vi-VN")}
              </div>
              <div className="mt-0.5 text-[12px] text-brand-navy/50">{label}</div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-2.5 text-[14px] font-extrabold text-brand-navy">{tilesTitle}</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PORTALS[portal].nav
          .filter((item) => item.key !== "dashboard")
          .map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="rounded-xl border border-black/5 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-[20px]" aria-hidden="true">
                {item.icon}
              </div>
              <div className="mt-2 text-[13.5px] font-extrabold text-brand-navy">{item.label}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-brand-navy/50">{item.desc}</p>
            </Link>
          ))}
      </div>

      <div className="rounded-xl border border-black/5 bg-white p-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-extrabold text-brand-navy">Hoạt động gần đây</h2>
          <span className="text-[12px] text-brand-navy/45">{data.summary}</span>
        </div>
        {data.activity.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-brand-navy/45">Chưa có hoạt động gần đây.</p>
        ) : (
          <div className="flex flex-col divide-y divide-black/5">
            {data.activity.map((item) => (
              <Link key={item.id} href={item.href} className="flex flex-wrap items-center gap-2 py-2.5 hover:bg-black/[0.02]">
                <span className="w-[108px] shrink-0 text-[11.5px] font-semibold text-brand-navy/40">{item.type}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-brand-navy">
                  {item.title}
                  {item.detail ? <span className="font-normal text-brand-navy/45"> · {item.detail}</span> : null}
                </span>
                <StatusPill label={item.label} tone={item.tone} />
                <span className="text-[11.5px] text-brand-navy/35">{item.createdAt ? formatDate(item.createdAt) : ""}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
