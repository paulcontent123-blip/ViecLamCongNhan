"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/routes";

const items = [
  { href: ROUTES.ntdDashboard, label: "🏢 Tổng quan", exact: true },
  { href: ROUTES.ntdDashboardPostJob, label: "📋 Đăng tin mới" },
  { href: ROUTES.ntdDashboardApplications, label: "👥 Ứng viên" },
  { href: ROUTES.ntdDashboardCandidates, label: "📂 Hồ sơ ứng viên" },
  { href: ROUTES.ntdDashboardCampaigns, label: "🏆 Chiến dịch" },
  { href: ROUTES.ntdDashboardOrders, label: "💳 Đơn hàng & Gói" },
  { href: ROUTES.ntdDashboardServices, label: "📦 Dịch vụ đã đặt" },
  { href: ROUTES.ntdDashboardProfile, label: "🧾 Thông tin tài khoản" },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-black/5 pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-b-0 lg:pb-0">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2.5 text-[13px] font-semibold transition ${
              active ? "bg-brand-orange text-white" : "text-brand-navy/60 hover:bg-brand-orange-light hover:text-brand-orange"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
