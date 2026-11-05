"use client";

// Form đăng nhập và đăng ký dùng chung cho các cổng đối tác. Phần khác nhau giữa các cổng (chữ, màu, hàm gọi API,
// danh sách ô nhập) truyền qua props; luồng xử lý, đặc biệt quy tắc "chưa xác định thì khoá nút", dùng chung.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TextField } from "@/components/dichvucongnhan/ui";
import { FieldGrid, type FieldDef, type FieldValues, type ProviderAccent } from "@/components/doitac/FieldGrid";
import { MobileApiError } from "@/lib/mobile-session-client";

export function ProviderLoginForm({
  icon,
  title,
  accent,
  login,
  dashboardHref,
  registerHref,
  registerLabel,
}: {
  icon: string;
  title: string;
  accent: ProviderAccent;
  login: (identifier: string, password: string) => Promise<void>;
  dashboardHref: string;
  registerHref: string;
  registerLabel: string;
}) {
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
      router.replace(dashboardHref);
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
        <div className="text-[32px]">{icon}</div>
        <h1 className="mt-1 text-[18px] font-extrabold text-brand-navy">{title}</h1>
        <p className="mt-1 text-[12.5px] text-brand-navy/50">
          Dùng chung tài khoản với app. Quên mật khẩu thì liên hệ Admin để được đặt lại.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <TextField label="Email hoặc số điện thoại" name="identifier" value={identifier} onChange={setIdentifier} disabled={busy} maxLength={254} accent={accent} />
        <TextField label="Mật khẩu" name="password" type="password" value={password} onChange={setPassword} disabled={busy} maxLength={128} accent={accent} />
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
        <Link href={registerHref} className={`font-bold ${accent.text}`}>
          {registerLabel}
        </Link>
      </p>
    </form>
  );
}

export function ProviderRegisterForm({
  title,
  intro,
  accent,
  fields,
  initialValues,
  validate,
  buildBody,
  register,
  loginHref,
  successTitle,
  successNote,
  footnote,
}: {
  title: string;
  intro: string;
  accent: ProviderAccent;
  fields: FieldDef[];
  initialValues: FieldValues;
  /** Kiểm tra sớm ở trình duyệt; trả null khi hợp lệ. Máy chủ vẫn là nơi quyết định. */
  validate: (values: FieldValues) => string | null;
  buildBody: (values: FieldValues) => Record<string, unknown>;
  register: (body: Record<string, unknown>) => Promise<string>;
  loginHref: string;
  successTitle: string;
  successNote: string;
  /** Dòng lưu ý nhỏ dưới các ô nhập. */
  footnote?: React.ReactNode;
}) {
  const [values, setValues] = useState<FieldValues>(initialValues);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Đăng ký hai lần tạo hai tài khoản, nên khi kết quả chưa rõ thì khoá luôn nút và chỉ mời đi đăng nhập.
  const locked = busy || done || Boolean(uncertain);

  async function submit() {
    if (locked) return;
    const invalid = validate(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await register(buildBody(values));
      setDone(true);
    } catch (err) {
      if (err instanceof MobileApiError && err.uncertain) setUncertain(err.message);
      else setError(err instanceof Error ? err.message : "Chưa tạo được tài khoản.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="text-[34px]">✅</div>
        <h2 className="mt-2 text-[16px] font-extrabold text-emerald-800">{successTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-emerald-700">{successNote}</p>
        <Link href={loginHref} className={`mt-5 inline-block rounded-xl px-6 py-2.5 text-[13px] font-bold ${accent.button}`}>
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  if (uncertain) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center" role="alert">
        <div className="text-[34px]">⚠️</div>
        <h2 className="mt-2 text-[16px] font-extrabold text-amber-800">Chưa xác định tài khoản đã tạo hay chưa</h2>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-amber-800">{uncertain}</p>
        <Link href={loginHref} className={`mt-5 inline-block rounded-xl px-6 py-2.5 text-[13px] font-bold ${accent.button}`}>
          Thử đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form
      className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <h2 className="text-[16px] font-extrabold text-brand-navy">{title}</h2>
      <p className="mt-1 text-[12.5px] text-brand-navy/50">{intro}</p>

      <div className="mt-4">
        <FieldGrid
          fields={fields}
          values={values}
          onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))}
          disabled={locked}
          accent={accent}
        />
      </div>

      {footnote && <p className="mt-2 text-[12px] leading-relaxed text-brand-navy/45">{footnote}</p>}

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={locked}
        className={`mt-4 w-full rounded-xl py-3 text-[14px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 ${accent.button}`}
      >
        {busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
      </button>

      <p className="mt-3 text-center text-[12.5px] text-brand-navy/50">
        Đã có tài khoản?{" "}
        <Link href={loginHref} className={`font-bold ${accent.text}`}>
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
