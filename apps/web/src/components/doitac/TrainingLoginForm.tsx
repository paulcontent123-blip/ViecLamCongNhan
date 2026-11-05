"use client";

import { PORTAL_ACCENT } from "@/lib/portal-accent";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TextField } from "@/components/dichvucongnhan/ui";
import { ROUTES } from "@/lib/routes";
import { login } from "@/lib/training-provider-client";

const accent = PORTAL_ACCENT;

export function TrainingLoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    if (!identifier.trim() || !password) {
      setError("Nhập email (hoặc số điện thoại) và mật khẩu.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await login(identifier.trim(), password);
      router.replace(ROUTES.hocNgheDoiTacDashboard);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa đăng nhập được.");
      setBusy(false);
    }
  }

  return (
    <form
      className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="text-center">
        <div className="text-[32px]">🎓</div>
        <h1 className="mt-1 text-[18px] font-extrabold text-brand-navy">Đăng nhập đơn vị đào tạo</h1>
        <p className="mt-1 text-[12.5px] text-brand-navy/50">
          Dùng chung tài khoản với app. Quên mật khẩu thì liên hệ Admin để được đặt lại.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <TextField
          label="Email hoặc số điện thoại"
          name="identifier"
          value={identifier}
          onChange={setIdentifier}
          disabled={busy}
          maxLength={254}
          accent={accent}
        />
        <TextField
          label="Mật khẩu"
          name="password"
          type="password"
          value={password}
          onChange={setPassword}
          disabled={busy}
          maxLength={128}
          accent={accent}
        />
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className={`mt-4 w-full rounded-xl py-3 text-[14px] font-extrabold transition disabled:opacity-60 ${accent.button}`}
      >
        {busy ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>

      <p className="mt-3 text-center text-[12.5px] text-brand-navy/50">
        Chưa có tài khoản?{" "}
        <Link href={ROUTES.hocNgheDoiTac} className={`font-bold ${accent.text}`}>
          Đăng ký đơn vị đào tạo
        </Link>
      </p>
    </form>
  );
}
