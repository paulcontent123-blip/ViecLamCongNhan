"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MobileStateCard } from "@/components/shared/mobileUi";
import { PORTAL_NAV, UnverifiedNotice } from "@/components/doitac/PortalChrome";
import { StatusPill } from "@/components/admin/StatusPill";
import { formatDate } from "@/lib/format-date";
import { isSessionExpired, messageOf } from "@/components/shared/useMobileList";
import { ROUTES } from "@/lib/routes";
import {
  getProfile,
  listApplications,
  listCourses,
  listInquiries,
  type ApplicationRow,
  type CourseRow,
  type InquiryRow,
  type ProviderProfile,
} from "@/lib/training-provider-client";
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_TONE,
  COURSE_STATUS_LABEL,
  COURSE_STATUS_TONE,
  INQUIRY_STATUS_LABEL,
  INQUIRY_STATUS_TONE,
} from "@/lib/training-provider-portal";

type Activity = {
  id: string;
  href: string;
  type: string;
  title: string;
  detail?: string | null;
  status: string;
  label: string;
  tone: "amber" | "green" | "red" | "gray" | "blue";
  createdAt: string | null;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

export function TrainingOverview() {
  const router = useRouter();
  const [profile, setProfile] = useState<(ProviderProfile & { email: string }) | null>(null);
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
      const current = await getProfile();
      setProfile(current);

      const results = await Promise.allSettled([
        listCourses({ page: 1, pageSize: 4 }),
        listCourses({ page: 1, pageSize: 1, status: "pending" }),
        listApplications({ page: 1, pageSize: 4 }),
        listApplications({ page: 1, pageSize: 1, status: "new" }),
        listInquiries({ page: 1, pageSize: 4 }),
        listInquiries({ page: 1, pageSize: 1, status: "new" }),
      ]);
      const [courses, pendingCourses, applications, newApplications, inquiries, newInquiries] = results;
      const totalOf = (result: PromiseSettledResult<{ total: number }>) =>
        result.status === "fulfilled" ? result.value.total : null;

      setCounts({
        pendingCourses: totalOf(pendingCourses),
        newApplications: totalOf(newApplications),
        newInquiries: totalOf(newInquiries),
        courses: totalOf(courses),
        applications: totalOf(applications),
        inquiries: totalOf(inquiries),
      });

      const recent: Activity[] = [];
      if (courses.status === "fulfilled") {
        for (const item of courses.value.items as CourseRow[]) {
          recent.push({
            id: `course-${item.id}`,
            href: ROUTES.hocNgheDoiTacCourses,
            type: "Khóa học",
            title: item.title,
            status: item.status,
            label: COURSE_STATUS_LABEL[item.status] ?? item.status,
            tone: COURSE_STATUS_TONE[item.status] ?? "gray",
            createdAt: text(item.created_at) || null,
          });
        }
      }
      if (applications.status === "fulfilled") {
        for (const item of applications.value.items as ApplicationRow[]) {
          recent.push({
            id: `application-${item.id}`,
            href: ROUTES.hocNgheDoiTacApplications,
            type: "Hồ sơ học viên",
            title: item.full_name,
            detail: text((item.vocational_courses as { title?: unknown } | null)?.title),
            status: item.status,
            label: APPLICATION_STATUS_LABEL[item.status] ?? item.status,
            tone: APPLICATION_STATUS_TONE[item.status] ?? "gray",
            createdAt: text(item.created_at) || null,
          });
        }
      }
      if (inquiries.status === "fulfilled") {
        for (const item of inquiries.value.items as InquiryRow[]) {
          recent.push({
            id: `inquiry-${item.id}`,
            href: ROUTES.hocNgheDoiTacInquiries,
            type: "Yêu cầu tư vấn",
            title: item.full_name,
            detail: text((item.vocational_courses as { title?: unknown } | null)?.title),
            status: item.status,
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
        router.replace(ROUTES.hocNgheDoiTacLogin);
        return;
      }
      setError(messageOf(err, "Chưa tải được dữ liệu đơn vị."));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !profile) return <MobileStateCard tone="loading" title="Đang tải tài khoản đơn vị đào tạo…" />;

  if (error && !profile) {
    return <MobileStateCard tone="error" title="Chưa tải được dữ liệu đơn vị" description={error} onRetry={load} />;
  }

  const tier = String(profile?.account_type ?? "free").toUpperCase();
  const expiresAt = text(profile?.account_tier_expires_at);
  const stats = [
    { value: counts.pendingCourses, label: "Khóa chờ duyệt" },
    { value: counts.newApplications, label: "Hồ sơ mới" },
    { value: counts.newInquiries, label: "Yêu cầu mới" },
    { value: counts.courses, label: "Tổng khóa học" },
  ];

  return (
    <>
      <div className="mb-4 rounded-2xl bg-gradient-to-br from-brand-orange to-brand-orange-2 p-5 text-white sm:p-6">
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">Đối tác học nghề</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <h1 className="text-[20px] font-extrabold">{profile?.provider_name || "Đơn vị đào tạo"}</h1>
          <span
            className={`rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${
              profile?.is_verified ? "bg-[#DBF7E8] text-[#146C43]" : "bg-amber-100 text-amber-800"
            }`}
          >
            {profile?.is_verified ? "Đã xác minh" : "Chưa xác minh"}
          </span>
        </div>
        <p className="mt-1.5 text-[12.5px] text-white/70">
          Gói {tier}
          {profile?.account_type === "free"
            ? " · Không giới hạn thời gian"
            : expiresAt
              ? ` · Hạn ${formatDate(expiresAt)}`
              : " · Chưa có thời hạn gói"}
          {profile?.email ? ` · ${profile.email}` : ""}
        </p>
      </div>

      {partial && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-medium text-amber-800">
          <span>{partial}</span>
          <button
            type="button"
            onClick={load}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-bold text-white"
          >
            Tải lại
          </button>
        </div>
      )}

      {profile && !profile.is_verified && <UnverifiedNotice />}

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

      <h2 className="mb-2.5 text-[14px] font-extrabold text-brand-navy">Quản lý đào tạo</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PORTAL_NAV.filter((item) => item.key !== "dashboard").map((item) => (
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
            {counts.applications ?? "—"} hồ sơ · {counts.inquiries ?? "—"} yêu cầu
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
