"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ROUTES } from "@/lib/routes";

type Role = "admin" | "employer";
type Mode = "login" | "register";

export function AuthModal({
  isOpen,
  onClose,
  initialRole = "admin",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: Role;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(initialRole);
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Render qua portal vào document.body: Navbar cha có backdrop-blur
  // (backdrop-filter) ‑ theo spec CSS, filter/backdrop-filter trên ancestor tạo
  // containing block mới cho position:fixed, khiến modal bị định vị theo khung
  // 62px của nav thay vì toàn viewport nếu render trực tiếp bên trong <nav>.
  useEffect(() => setMounted(true), []);

  // Đồng bộ role khi modal được mở lại với initialRole khác (vd: nút "Tạo tài
  // khoản NTD" ở trang Tuyển dụng cần mở thẳng vào role employer). Reset cả
  // loading ở đây để phòng vệ kép ‑ modal là component sống xuyên suốt (chỉ
  // return null khi đóng, không unmount) nên state cũ có thể còn sót lại.
  useEffect(() => {
    if (isOpen) {
      setRole(initialRole);
      setMode("login");
      setError(null);
      setLoading(false);
    }
  }, [isOpen, initialRole]);

  if (!isOpen || !mounted) return null;

  function selectRole(next: Role) {
    setRole(next);
    setMode("login");
    setError(null);
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const endpoint = role === "admin" ? "/api/auth/admin/login" : "/api/auth/employer/login";
      const body =
        role === "admin"
          ? { email: form.get("identifier"), password: form.get("password") }
          : { identifier: form.get("identifier"), password: form.get("password") };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Đăng nhập thất bại.");
        setLoading(false);
        return;
      }

      setLoading(false);
      onClose();
      router.push(role === "admin" ? ROUTES.admin : ROUTES.ntdDashboard);
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, thử lại sau.");
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/employers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.get("companyName"),
          contactPhone: form.get("contactPhone"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Có lỗi xảy ra, thử lại sau.");
        setLoading(false);
        return;
      }

      setLoading(false);
      onClose();
      router.push(ROUTES.ntdDashboard);
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, thử lại sau.");
      setLoading(false);
    }
  }

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
          <div className="mt-1 text-[12.5px] text-brand-navy/45">Đăng nhập hệ thống quản trị</div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-lg bg-black/[0.04] p-1">
          <button
            type="button"
            onClick={() => selectRole("admin")}
            className={`rounded-md py-2 text-[12.5px] font-bold transition ${
              role === "admin" ? "bg-white text-brand-orange shadow-sm" : "text-brand-navy/50"
            }`}
          >
            🔒 Nội bộ
          </button>
          <button
            type="button"
            onClick={() => selectRole("employer")}
            className={`rounded-md py-2 text-[12.5px] font-bold transition ${
              role === "employer" ? "bg-white text-brand-orange shadow-sm" : "text-brand-navy/50"
            }`}
          >
            🏢 Nhà tuyển dụng
          </button>
        </div>

        {role === "employer" && mode === "login" && (
          <div className="mt-3 rounded-lg border border-brand-orange/20 bg-brand-orange-light px-3 py-2 text-[12px] text-brand-navy/70">
            Chưa có tài khoản?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className="font-bold text-brand-orange"
            >
              Đăng ký ngay →
            </button>
          </div>
        )}

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="mt-4">
            <label className="block text-[12px] font-semibold text-brand-navy/60">
              {role === "employer" ? "Email / SĐT" : "Email"}
              <input
                name="identifier"
                required
                autoComplete="username"
                className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
              />
            </label>
            <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
              Mật khẩu
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
              />
            </label>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-brand-orange py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập →"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="mt-4">
            <label className="block text-[12px] font-semibold text-brand-navy/60">
              Tên đơn vị / Công ty
              <input
                name="companyName"
                required
                minLength={2}
                placeholder="VD: Công ty TNHH ABC"
                className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
              />
            </label>
            <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
              Số điện thoại liên hệ
              <input
                name="contactPhone"
                type="tel"
                required
                minLength={9}
                placeholder="0909 123 456"
                className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
              />
            </label>
            <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
              Email đăng nhập
              <input
                name="email"
                type="email"
                required
                placeholder="hr@congty.com"
                className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
              />
            </label>
            <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
              Mật khẩu
              <input
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Tối thiểu 8 ký tự"
                className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
              />
            </label>

            {error && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-brand-orange py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
            >
              {loading ? "Đang tạo tài khoản..." : "Tạo tài khoản →"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className="mt-3 w-full text-center text-[11.5px] text-brand-navy/45"
            >
              ← Đã có tài khoản? Đăng nhập
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
