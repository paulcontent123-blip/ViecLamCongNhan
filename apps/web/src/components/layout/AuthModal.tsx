"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UnifiedLoginForm } from "@/components/auth/UnifiedLoginForm";
import { ROUTES } from "@/lib/routes";

type Role = "admin" | "employer";

// Cửa sổ đăng nhập chung: người dùng chỉ nhập tài khoản và mật khẩu, hệ thống tự nhận loại tài khoản
// (Admin, Nhà tuyển dụng, Đối tác, Công nhân) và đưa về đúng trang. Đăng ký nằm ở trang /dang-ky.
// `initialRole` chỉ còn dùng để gợi ý ngăn đăng ký phù hợp (ví dụ nút "Tạo tài khoản" của Nhà tuyển dụng).
export function AuthModal({
  isOpen,
  onClose,
  initialRole = "admin",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: Role;
}) {
  const [mounted, setMounted] = useState(false);

  // Render qua portal vào document.body: Navbar cha có backdrop-blur
  // (backdrop-filter) ‑ theo spec CSS, filter/backdrop-filter trên ancestor tạo
  // containing block mới cho position:fixed, khiến modal bị định vị theo khung
  // 62px của nav thay vì toàn viewport nếu render trực tiếp bên trong <nav>.
  useEffect(() => setMounted(true), []);

  if (!isOpen || !mounted) return null;

  const registerHref = initialRole === "employer" ? `${ROUTES.dangKy}?tab=doi-tac` : ROUTES.dangKy;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-4 top-4 text-[16px] text-brand-navy/40 hover:text-brand-navy"
        >
          ✕
        </button>

        <div className="text-center">
          <div className="text-[16px] font-extrabold text-brand-navy">
            ViecLam<span className="text-brand-orange">CongNhan</span>
          </div>
          <div className="mt-1 text-[12.5px] text-brand-navy/45">Đăng nhập tài khoản</div>
        </div>

        <div className="mt-4">
          <UnifiedLoginForm onDone={onClose} registerHref={registerHref} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
