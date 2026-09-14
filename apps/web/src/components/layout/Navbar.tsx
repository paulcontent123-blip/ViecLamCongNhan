"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { useAuthModal } from "@/components/layout/AuthModalContext";

const timViecItems = [
  { href: `${ROUTES.timViecLam}?tab=jobs`, icon: "🔍", label: "Tìm việc theo ngành / lương" },
  { href: `${ROUTES.timViecLam}?tab=kcn`, icon: "🏭", label: "Khám phá KCN toàn quốc" },
];

// Luôn trỏ về trang công khai (giới thiệu + bảng giá), bất kể đã đăng nhập NTD
// hay chưa — đúng hành vi bản HTML gốc (nav('tuyendung',null);switchTDTab(...)).
// Khi đã đăng nhập, các chức năng thật (đăng tin, ứng viên, đơn hàng...) đã có
// sẵn trong sidebar dashboard NTD rồi nên không cần đổi mục menu này theo trạng
// thái đăng nhập nữa — tránh trùng lặp 2 chỗ điều hướng.
const tuyenDungItemsPublic = [
  { href: `${ROUTES.tuyenDung}?tab=dang`, icon: "📋", label: "Đăng bài tuyển dụng" },
  { href: `${ROUTES.tuyenDung}?tab=goi`, icon: "💼", label: "Gói đăng tin tuyển dụng" },
  { href: `${ROUTES.tuyenDung}?tab=blast`, icon: "📲", label: "Dịch vụ Blast SMS / Zalo" },
];

const simpleLinks = [
  { href: ROUTES.quangCaoHopTac, label: "Quảng cáo / Hợp tác" },
  { href: ROUTES.dichVuTronGoi, label: "Dịch vụ trọn gói" },
  { href: ROUTES.tinTucQuyenLoi, label: "Tin tức & Quyền lợi" },
];

function NavDropdown({
  label,
  href,
  items,
}: {
  label: string;
  href: string;
  items: { href: string; icon: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 whitespace-nowrap rounded-[7px] px-[9px] py-[5px] text-[12px] font-semibold text-brand-navy/70 transition-colors hover:bg-brand-orange-light hover:text-brand-orange"
        aria-expanded={open}
      >
        <Link href={href} onClick={(e) => e.stopPropagation()}>
          {label}
        </Link>
        <span className="text-[9px] opacity-50">▾</span>
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-40 min-w-[210px] -translate-x-1/2 rounded-[10px] border border-black/5 bg-white p-2 shadow-xl">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 whitespace-nowrap rounded-[7px] px-[14px] py-[9px] text-[13px] font-medium text-brand-navy/70 hover:bg-brand-orange-light hover:text-brand-orange"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// 1 nút đăng nhập/tài khoản duy nhất thay vì 2 nút Quản trị + Nhà tuyển dụng
// tách rời — vừa gọn chỗ trên menu, vừa gộp đúng logic: đăng nhập quyền nào
// hiện tên quyền đó và trỏ thẳng vào trang tương ứng; chưa đăng nhập quyền
// nào thì mở modal (có sẵn tab chọn quyền). Trường hợp hiếm khi đăng nhập cả
// 2 quyền cùng lúc (2 cookie phiên độc lập) thì gộp thành dropdown nhỏ.
function AuthNavButton({
  isAdminLoggedIn,
  isEmployerLoggedIn,
  variant,
  onNavigate,
}: {
  isAdminLoggedIn: boolean;
  isEmployerLoggedIn: boolean;
  variant: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { openAuthModal } = useAuthModal();

  const className =
    variant === "desktop"
      ? "whitespace-nowrap rounded-[7px] border border-brand-orange/30 bg-brand-orange/10 px-4 py-[7px] text-[12.5px] font-bold text-brand-orange transition-colors hover:bg-brand-orange/20"
      : "rounded-lg border border-brand-orange/30 bg-brand-orange/10 px-4 py-2.5 text-center text-[13px] font-bold text-brand-orange";

  if (isAdminLoggedIn && isEmployerLoggedIn) {
    return (
      <div
        className="relative"
        onMouseEnter={() => variant === "desktop" && setOpen(true)}
        onMouseLeave={() => variant === "desktop" && setOpen(false)}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${className} flex items-center justify-center gap-1`}
          aria-expanded={open}
        >
          Tài khoản <span className="text-[10px]">▾</span>
        </button>
        {open && (
          <div
            className={`absolute top-full z-40 min-w-[180px] rounded-xl border border-black/5 bg-white p-2 shadow-xl ${
              variant === "desktop" ? "right-0" : "left-0 w-full"
            }`}
          >
            <Link
              href={ROUTES.admin}
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="block rounded-lg px-3 py-2.5 text-[13px] font-medium text-brand-navy/85 hover:bg-brand-orange-light hover:text-brand-orange"
            >
              ⚙ Quản trị
            </Link>
            <Link
              href={ROUTES.ntdDashboard}
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="block rounded-lg px-3 py-2.5 text-[13px] font-medium text-brand-navy/85 hover:bg-brand-orange-light hover:text-brand-orange"
            >
              🏢 Nhà tuyển dụng
            </Link>
          </div>
        )}
      </div>
    );
  }

  if (isAdminLoggedIn) {
    return (
      <Link href={ROUTES.admin} className={className} onClick={onNavigate}>
        ⚙ Quản trị
      </Link>
    );
  }

  if (isEmployerLoggedIn) {
    return (
      <Link href={ROUTES.ntdDashboard} className={className} onClick={onNavigate}>
        🏢 Nhà tuyển dụng
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onNavigate?.();
        openAuthModal("admin");
      }}
      className={className}
    >
      Quản trị / Nhà tuyển dụng
    </button>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [employerCompanyName, setEmployerCompanyName] = useState<string | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const isEmployerLoggedIn = Boolean(employerCompanyName);

  // Navbar sống xuyên suốt qua điều hướng client-side (nằm trong layout gốc,
  // không unmount) nên chỉ fetch 1 lần lúc mount là chưa đủ — sau khi đăng
  // xuất, nút tài khoản (AuthNavButton) sẽ vẫn hiển thị trạng thái cũ đã đăng
  // nhập cho tới khi có dịp mount lại. Refetch mỗi khi pathname đổi (router
  // .refresh()/push() sau login/logout đều kéo theo đổi pathname) để trạng
  // thái luôn khớp với cookie phiên hiện tại.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/employer/me")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setEmployerCompanyName(data.loggedIn ? data.companyName : null);
      })
      .catch(() => {});
    fetch("/api/auth/admin/me")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setIsAdminLoggedIn(Boolean(data.loggedIn));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <nav className="sticky top-0 z-50 flex h-[60px] items-center justify-between border-b-[3px] border-brand-orange bg-[rgba(247,248,252,0.97)] px-4 shadow-sm backdrop-blur sm:px-8 lg:px-[52px]">
      <Link href={ROUTES.home} className="flex items-center gap-2 shrink-0">
        <span className="text-xl">🏭</span>
        <span className="text-[15px] font-extrabold text-brand-navy">
          ViecLam<span className="text-brand-orange">CongNhan</span>.com
        </span>
      </Link>

      <div className="hidden items-center gap-px min-[1360px]:flex">
        <Link
          href={ROUTES.home}
          className="whitespace-nowrap rounded-[7px] px-[9px] py-[5px] text-[12px] font-semibold text-brand-navy/70 transition-colors hover:bg-brand-orange-light hover:text-brand-orange"
        >
          Trang chủ
        </Link>
        <NavDropdown label="Tìm việc làm" href={ROUTES.timViecLam} items={timViecItems} />
        <NavDropdown label="Tuyển dụng" href={ROUTES.tuyenDung} items={tuyenDungItemsPublic} />
        {simpleLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="whitespace-nowrap rounded-[7px] px-[9px] py-[5px] text-[12px] font-semibold text-brand-navy/70 transition-colors hover:bg-brand-orange-light hover:text-brand-orange"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="hidden items-center gap-2 min-[1360px]:flex">
        <AuthNavButton isAdminLoggedIn={isAdminLoggedIn} isEmployerLoggedIn={isEmployerLoggedIn} variant="desktop" />
        <Link
          href={ROUTES.ungVien}
          className="whitespace-nowrap rounded-lg bg-gradient-to-br from-brand-orange to-[#E06428] px-5 py-[9px] text-[13px] font-bold text-white shadow-sm transition-transform hover:brightness-105"
        >
          Để lại thông tin →
        </Link>
      </div>

      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 text-lg min-[1360px]:hidden"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? "✕" : "☰"}
      </button>

      {mobileOpen && (
        <div className="mobile-menu-panel absolute left-0 top-[60px] flex w-full flex-col gap-1 border-b border-black/5 bg-white p-3 shadow-lg min-[1360px]:hidden">
          <Link href={ROUTES.home} className="rounded-lg px-3 py-2.5 text-[14px] font-semibold text-brand-navy" onClick={() => setMobileOpen(false)}>
            Trang chủ
          </Link>
          <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-brand-navy/40">Tìm việc làm</div>
          {timViecItems.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2.5 text-[14px] text-brand-navy/85" onClick={() => setMobileOpen(false)}>
              {item.icon} {item.label}
            </Link>
          ))}
          <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-brand-navy/40">Tuyển dụng</div>
          {tuyenDungItemsPublic.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2.5 text-[14px] text-brand-navy/85" onClick={() => setMobileOpen(false)}>
              {item.icon} {item.label}
            </Link>
          ))}
          {simpleLinks.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2.5 text-[14px] font-semibold text-brand-navy" onClick={() => setMobileOpen(false)}>
              {link.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-black/5 pt-3">
            <AuthNavButton
              isAdminLoggedIn={isAdminLoggedIn}
              isEmployerLoggedIn={isEmployerLoggedIn}
              variant="mobile"
              onNavigate={() => setMobileOpen(false)}
            />
            <Link href={ROUTES.ungVien} className="rounded-lg bg-brand-orange px-4 py-2.5 text-center text-[13px] font-bold text-white" onClick={() => setMobileOpen(false)}>
              Để lại thông tin →
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
