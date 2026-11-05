"use client";

// Form đăng nhập một ô chung cho mọi loại tài khoản (Admin, Nhà tuyển dụng, Đối tác, Công nhân). Dùng trong cửa sổ đăng nhập
// của thanh menu và ở trang /dang-nhap. Loại tài khoản do hệ thống tự nhận, người dùng không phải chọn.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoginError, unifiedLogin } from "@/lib/unified-login";
import { ROUTES } from "@/lib/routes";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange";

export function UnifiedLoginForm({
  onDone,
  registerHref = ROUTES.dangKy,
}: {
  /** Gọi ngay trước khi chuyển trang (cửa sổ đăng nhập dùng để tự đóng). */
  onDone?: () => void;
  registerHref?: string;
}) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setPending(false);
    try {
      const target = await unifiedLogin(identifier, password);
      onDone?.();
      router.push(target.href);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa đăng nhập được. Vui lòng thử lại.");
      setPending(err instanceof LoginError && err.kind === "pending");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="block text-[12px] font-semibold text-brand-navy/60">
        Email hoặc số điện thoại
        <input
          name="identifier"
          required
          autoComplete="username"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          disabled={busy}
          className={inputClass}
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
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
          className={inputClass}
        />
      </label>

      {error && (
        <div
          className={`mt-3 rounded-lg px-3 py-2.5 text-[13px] font-medium ${pending ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}
          role="alert"
        >
          {pending ? "⏳ " : ""}
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-lg bg-brand-orange py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
      >
        {busy ? "Đang đăng nhập..." : "Đăng nhập →"}
      </button>

      <p className="mt-3 text-center text-[12.5px] text-brand-navy/50">
        Chưa có tài khoản?{" "}
        <Link href={registerHref} onClick={() => onDone?.()} className="font-bold text-brand-orange">
          Đăng ký ngay
        </Link>
      </p>
    </form>
  );
}
