"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ROUTES } from "@/lib/routes";
import { adminCan, type AdminCapability, type AdminRole } from "@/lib/admin-roles";

interface AdminSidebarCounts {
  pendingJobs: number;
  totalCandidates: number;
  totalApplications: number;
  unverifiedEmployers: number;
  newQuestions: number;
  newServiceInquiries: number;
  newKcnAdInquiries: number;
  newServicePartnerInquiries: number;
  newAdPricingInquiries: number;
}

interface NavItem {
  href: string;
  icon: string;
  label: string;
  badge?: number;
  exact?: boolean;
  /** Mục chỉ hiện với tài khoản có quyền này (chặn thật nằm ở máy chủ). */
  capability?: AdminCapability;
  children?: NavItem[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function buildGroups(counts: AdminSidebarCounts): NavGroup[] {
  return [
    {
      label: "Tổng quan",
      items: [{ href: ROUTES.admin, icon: "📊", label: "Dashboard", exact: true }],
    },
    {
      label: "Nội dung",
      items: [
        { href: ROUTES.adminJobs, icon: "📋", label: "Tin tuyển dụng", badge: counts.pendingJobs || undefined },
        { href: ROUTES.adminKcn, icon: "🏭", label: "KCN toàn quốc" },
        { href: ROUTES.adminNews, icon: "📰", label: "Tin tức / Bài viết" },
        { href: ROUTES.adminRights, icon: "⚖", label: "Quyền lợi NLĐ" },
        { href: ROUTES.adminQA, icon: "❓", label: "Hỏi đáp", badge: counts.newQuestions || undefined },
        { href: ROUTES.adminServicePackages, icon: "📦", label: "Dịch vụ trọn gói", badge: counts.newServiceInquiries || undefined },
      ],
    },
    {
      label: "Tuyển dụng",
      items: [
        { href: ROUTES.adminApplications, icon: "📨", label: "Đơn ứng tuyển", badge: counts.totalApplications || undefined },
        { href: ROUTES.adminCandidates, icon: "👥", label: "Ứng viên", badge: counts.totalCandidates || undefined },
        {
          href: ROUTES.adminEmployers,
          icon: "🏢",
          label: "Nhà tuyển dụng",
          badge: counts.unverifiedEmployers || undefined,
        },
        { href: ROUTES.adminWorkerInquiries, icon: "🙋", label: "Yêu cầu dịch vụ công nhân" },
        { href: ROUTES.adminCandidateAccounts, icon: "✅", label: "Xác nhận tài khoản công nhân", capability: "admin_users" },
        { href: ROUTES.adminCandidateDeletions, icon: "🗑️", label: "Yêu cầu xóa tài khoản", capability: "admin_users" },
        { href: ROUTES.adminBlast, icon: "📲", label: "Blast campaigns" },
      ],
    },
    {
      // Các mục trước đây chỉ làm được trên app Admin; nay dùng chung api/mobile/admin/* với app.
      label: "Đối tác & Ứng dụng",
      items: [
        {
          href: ROUTES.adminPartners,
          icon: "🤝",
          label: "Đối tác dịch vụ",
          capability: "partners",
          exact: true,
          // Mục con nằm trong mục cha nên đã theo quyền của cha; lọc quyền chỉ chạy ở cấp một.
          children: [{ href: ROUTES.adminPartnerContent, icon: "✅", label: "Duyệt nội dung" }],
        },
        { href: ROUTES.adminBugReports, icon: "🐞", label: "Báo lỗi ứng dụng" },
      ],
    },
    {
      label: "Hệ thống",
      items: [
        { href: ROUTES.adminOrders, icon: "💳", label: "Đơn hàng / Thanh toán", capability: "payments" },
        { href: ROUTES.adminPaymentChannels, icon: "💰", label: "Kênh nhận tiền", capability: "payments" },
        {
          href: ROUTES.adminAds,
          icon: "📢",
          label: "Quảng cáo / Hợp tác",
          children: [
            {
              href: ROUTES.adminKcnAds,
              icon: "📍",
              label: "Quảng cáo theo KCN",
            },
            {
              href: ROUTES.adminAds,
              icon: "🤝",
              label: "Đối tác dịch vụ",
              badge: counts.newServicePartnerInquiries || undefined,
            },
            {
              href: ROUTES.adminAdPlacements,
              icon: "📣",
              label: "Banner / Card hiển thị",
            },
            {
              href: ROUTES.adminAdPricing,
              icon: "💰",
              label: "Bảng giá quảng cáo",
              badge: counts.newAdPricingInquiries || undefined,
              exact: true,
            },
          ],
        },
        { href: ROUTES.adminUsers, icon: "👤", label: "Người dùng", capability: "admin_users" },
        { href: ROUTES.adminSettings, icon: "⚙️", label: "Cài đặt" },
      ],
    },
  ];
}

function AdminNavItem({ item, pathname, level = 0 }: { item: NavItem; pathname: string; level?: number }) {
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  const classes = [
    "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-[13px] font-semibold transition lg:min-w-0 lg:shrink lg:whitespace-normal",
    level > 0 ? "ml-2 text-[12.5px]" : "",
    active
      ? "bg-brand-orange-light text-brand-orange"
      : "text-brand-navy/60 hover:bg-brand-navy/[0.04] hover:text-brand-navy",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <Link href={item.href} className={classes} data-active={active ? "true" : undefined}>
        <span>{item.icon}</span>
        <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
        {item.badge !== undefined && (
          <span className="rounded-full bg-brand-orange px-1.5 py-0.5 text-[10px] font-bold text-white">
            {item.badge.toLocaleString("vi-VN")}
          </span>
        )}
      </Link>
      {item.children && (
        <div className="ml-3 flex flex-col gap-0.5 border-l border-black/5 pl-1">
          {item.children.map((child) => (
            <AdminNavItem key={child.href + child.label} item={child} pathname={pathname} level={level + 1} />
          ))}
        </div>
      )}
    </>
  );
}

export function AdminSidebar({ counts, adminRole }: { counts: AdminSidebarCounts; adminRole: AdminRole }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // Menu có thanh cuộn riêng và đứng yên khi chuyển trang (layout không tải lại). Chỉ khi mục đang chọn nằm ngoài vùng nhìn
  // thấy (ví dụ mở thẳng một đường dẫn) mới cuộn tới đó; nếu đã thấy thì giữ nguyên vị trí.
  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>("[data-active=true]")?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  const groups = buildGroups(counts)
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.capability || adminCan(adminRole, item.capability)) }))
    .filter((group) => group.items.length > 0);

  return (
    <nav
      ref={navRef}
      className="border-b border-black/5 bg-white px-2 py-3 lg:sticky lg:top-[60px] lg:h-[calc(100vh-60px)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-r lg:px-0 lg:py-4"
    >
      {groups.map((group) => (
        <div key={group.label} className="mb-1 lg:mb-3">
          <div className="hidden px-5 pb-1.5 pt-3 text-[10.5px] font-bold uppercase tracking-wider text-brand-navy/35 lg:block first:pt-0">
            {group.label}
          </div>
          <div className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-2">
            {group.items.map((item) => (
              <AdminNavItem key={item.href + item.label} item={item} pathname={pathname} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
