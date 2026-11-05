"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import { PORTALS, UnverifiedNotice } from "@/components/doitac/PortalChrome";
import { MobileStateCard } from "@/components/shared/mobileUi";
import { isSessionExpired, messageOf } from "@/components/shared/useMobileList";
import { formatDate } from "@/lib/format-date";
import {
  getProfile,
  listInquiries,
  listServices,
  type HealthProfile,
  type InquiryRow,
  type ServiceRow,
} from "@/lib/health-provider-client";
import {
  INQUIRY_STATUS_LABEL,
  INQUIRY_STATUS_TONE,
  SERVICE_STATUS_LABEL,
  SERVICE_STATUS_TONE,
  type StatusTone,
} from "@/lib/health-provider-portal";
import { ROUTES } from "@/lib/routes";

type Activity = {
  id: string;
  href: string;
  type: string;
  title: string;
  detail?: string | null;
  label: string;
  tone: StatusTone;
  createdAt: string | null;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

export const UNVERIFIED_HEALTH_MESSAGE =
  "Chưa gửi được dịch vụ duyệt và chưa mở được liên hệ. Admin cần đối chiếu số giấy phép và hồ sơ chứng minh trước khi xác minh.";

export function HealthOverview() {
  const router = useRouter();
  const [profile, setProfile] = useState<(HealthProfile & { email: string }) | null>(null);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setPartial("");
    try {
      // Hồ sơ là bắt buộc; các số liệu còn lại hỏng một phần thì vẫn hiện được phần còn lại.
      setProfile(await getProfile());

      const results = await Promise.allSettled([
        listServices({ page: 1, pageSize: 4 }),
        listServices({ page: 1, pageSize: 1, status: "pending" }),
        listInquiries({ page: 1, pageSize: 4 }),
        listInquiries({ page: 1, pageSize: 1, status: "new" }),
      ]);
      const [services, pendingServices, inquiries, newInquiries] = results;
      const totalOf = (result: PromiseSettledResult<{ total: number }>) =>
        result.status === "fulfilled" ? result.value.total : null;

      setCounts({
        pendingServices: totalOf(pendingServices),
        newInquiries: totalOf(newInquiries),
        services: totalOf(services),
        inquiries: totalOf(inquiries),
      });

      const recent: Activity[] = [];
      if (services.status === "fulfilled") {
        for (const item of services.value.items as ServiceRow[]) {
          recent.push({
            id: `service-${item.id}`,
            href: ROUTES.yTeDoiTacServices,
            type: "Dịch vụ",
            title: item.title,
            label: SERVICE_STATUS_LABEL[item.status] ?? item.status,
            tone: SERVICE_STATUS_TONE[item.status] ?? "gray",
            createdAt: text(item.created_at) || null,
          });
        }
      }
      if (inquiries.status === "fulfilled") {
        for (const item of inquiries.value.items as InquiryRow[]) {
          recent.push({
            id: `inquiry-${item.id}`,
            href: ROUTES.yTeDoiTacInquiries,
            type: "Yêu cầu liên hệ",
            title: item.full_name,
            detail: text((item.service as { title?: unknown } | null)?.title),
            label: INQUIRY_STATUS_LABEL[item.status] ?? item.status,
            tone: INQUIRY_STATUS_TONE[item.status] ?? "gray",
            createdAt: text(item.created_at) || null,
          });
        }
      }
      recent.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
      setActivity(recent.slice(0, 6));

      if (results.some((result) => result.status === "rejected")) {
        setPartial("Một số số liệu chưa tải được. Bấm tải lại để thử lần nữa.");
      }
    } catch (err) {
      if (isSessionExpired(err)) {
        router.replace(ROUTES.yTeDoiTacLogin);
        return;
      }
      setError(messageOf(err, "Chưa tải được dữ liệu cơ sở."));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !profile) return <MobileStateCard tone="loading" title="Đang tải tài khoản cơ sở y tế…" />;
  if (error && !profile) {
    return <MobileStateCard tone="error" title="Chưa tải được dữ liệu cơ sở" description={error} onRetry={load} />;
  }

  const limit = typeof profile?.contact_view_limit === "number" ? profile.contact_view_limit : 0;
  const stats = [
    { value: counts.pendingServices, label: "Dịch vụ chờ duyệt" },
    { value: counts.newInquiries, label: "Yêu cầu mới" },
    { value: counts.services, label: "Tổng dịch vụ" },
    { value: counts.inquiries, label: "Tổng yêu cầu" },
  ];

  return (
    <>
      <div className="mb-4 rounded-2xl bg-gradient-to-br from-brand-orange to-brand-orange-2 p-5 text-white sm:p-6">
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">Đối tác y tế</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h1 className="text-[20px] font-extrabold">{profile?.provider_name || "Cơ sở y tế"}</h1>
          <span
            className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${
              profile?.is_verified ? "bg-[#DBF7E8] text-[#146C43]" : "bg-amber-100 text-amber-800"
            }`}
          >
            {profile?.is_verified ? "Đã xác minh" : "Chưa xác minh"}
          </span>
        </div>
        <p className="mt-1.5 text-[12.5px] text-white/70">
          Hạn mức mở liên hệ: {limit.toLocaleString("vi-VN")} lượt/tháng
          {profile?.email ? ` · ${profile.email}` : ""}
        </p>
      </div>

      {partial && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-medium text-amber-800">
          <span>{partial}</span>
          <button type="button" onClick={load} className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-bold text-white">
            Tải lại
          </button>
        </div>
      )}

      {profile && !profile.is_verified && <UnverifiedNotice message={UNVERIFIED_HEALTH_MESSAGE} />}

      {profile?.is_verified && limit === 0 && (
        <div className="mb-4 rounded-xl border border-black/5 bg-white px-4 py-3 text-[12.5px] leading-relaxed text-brand-navy/60">
          Cơ sở nhận được yêu cầu nhưng <strong className="font-extrabold text-brand-navy">chưa mở được số điện thoại</strong>{" "}
          vì hạn mức đang là 0. Hạn mức do Admin cấp; liên hệ Admin để được cấp lượt mở liên hệ.
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-black/5 bg-white p-4 text-center">
            <div className="text-[22px] font-extrabold text-brand-orange">
              {stat.value === null || stat.value === undefined ? "—" : stat.value.toLocaleString("vi-VN")}
            </div>
            <div className="mt-0.5 text-[12px] text-brand-navy/50">{stat.label}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-2.5 text-[14px] font-extrabold text-brand-navy">Quản lý cơ sở</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {PORTALS.health.nav
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
          <span className="text-[12px] text-brand-navy/45">
            {counts.services ?? "—"} dịch vụ · {counts.inquiries ?? "—"} yêu cầu
          </span>
        </div>
        {activity.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-brand-navy/45">Chưa có hoạt động gần đây.</p>
        ) : (
          <div className="flex flex-col divide-y divide-black/5">
            {activity.map((item) => (
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
