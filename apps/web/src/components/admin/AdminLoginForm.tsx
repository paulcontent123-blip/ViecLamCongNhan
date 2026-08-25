"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Đăng nhập thất bại.");
        setLoading(false);
        return;
      }

      router.push(searchParams.get("from") || "/admin");
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, thử lại sau.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-black/5 bg-white p-6 shadow-lg">
      <div className="text-center">
        <div className="text-[26px]">⚙</div>
        <div className="mt-1 text-[16px] font-extrabold text-brand-navy">Đăng nhập Quản trị</div>
        <p className="mt-1 text-[12.5px] text-brand-navy/45">Tài khoản admin được cấp trực tiếp trên hệ thống.</p>
      </div>

      <label className="mt-5 block text-[12px] font-semibold text-brand-navy/60">
        Email
        <input
          name="email"
          type="email"
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
          className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
        />
      </label>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full rounded-lg bg-brand-orange py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
      >
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
