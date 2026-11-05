"use client";

import { PORTAL_ACCENT } from "@/lib/portal-accent";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SelectField, TextField } from "@/components/dichvucongnhan/ui";
import { HEALTH_PROVIDER_TYPES, registerBody, validateRegisterForm, type RegisterFormValues } from "@/lib/health-provider-portal";
import { login, register } from "@/lib/health-provider-client";
import { MobileApiError } from "@/lib/mobile-session-client";
import { PROVINCES } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";

const accent = PORTAL_ACCENT;
const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));

const EMPTY: RegisterFormValues = {
  providerName: "",
  providerType: "clinic",
  contactName: "",
  contactPhone: "",
  email: "",
  password: "",
  provinceCode: "",
  address: "",
  taxCode: "",
  licenseNumber: "",
  licenseEvidenceUrl: "",
};

export function HealthRegisterForm() {
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (key: keyof RegisterFormValues) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  // Đăng ký hai lần tạo hai tài khoản, nên khi kết quả chưa rõ thì khoá luôn nút và chỉ mời đi đăng nhập.
  const locked = busy || done || Boolean(uncertain);

  async function submit() {
    if (locked) return;
    const invalid = validateRegisterForm(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await register(registerBody(values));
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
        <h2 className="mt-2 text-[16px] font-extrabold text-emerald-800">Đã tạo tài khoản cơ sở y tế</h2>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-emerald-700">
          Đăng nhập bằng email vừa đăng ký để hoàn thiện hồ sơ. Admin cần xác minh cơ sở (đối chiếu số giấy phép và
          hồ sơ chứng minh) trước khi bạn gửi dịch vụ và mở liên hệ.
        </p>
        <Link
          href={ROUTES.yTeDoiTacLogin}
          className={`mt-5 inline-block rounded-xl px-6 py-2.5 text-[13px] font-bold ${accent.button}`}
        >
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
        <Link
          href={ROUTES.yTeDoiTacLogin}
          className={`mt-5 inline-block rounded-xl px-6 py-2.5 text-[13px] font-bold ${accent.button}`}
        >
          Thử đăng nhập
        </Link>
      </div>
    );
  }

  const field = { disabled: locked, accent } as const;

  return (
    <form
      className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <h2 className="text-[16px] font-extrabold text-brand-navy">Đăng ký cơ sở y tế</h2>
      <p className="mt-1 text-[12.5px] text-brand-navy/50">
        Tài khoản dùng chung với app. Đăng ký xong, Admin sẽ xác minh trước khi cơ sở gửi dịch vụ.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <TextField label="Tên cơ sở y tế *" name="providerName" value={values.providerName} onChange={set("providerName")} maxLength={160} {...field} />
        <SelectField label="Loại cơ sở *" name="providerType" value={values.providerType} onChange={set("providerType")} options={HEALTH_PROVIDER_TYPES} {...field} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Người phụ trách *" name="contactName" value={values.contactName} onChange={set("contactName")} maxLength={120} {...field} />
          <TextField label="Số điện thoại liên hệ *" name="contactPhone" type="tel" inputMode="tel" value={values.contactPhone} onChange={set("contactPhone")} maxLength={20} {...field} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Email đăng nhập *" name="email" type="email" inputMode="email" value={values.email} onChange={set("email")} maxLength={254} {...field} />
          <TextField label="Mật khẩu (tối thiểu 8 ký tự) *" name="password" type="password" value={values.password} onChange={set("password")} maxLength={128} {...field} />
        </div>
        <SelectField label="Tỉnh/thành" name="provinceCode" value={values.provinceCode} onChange={set("provinceCode")} options={PROVINCE_OPTIONS} placeholder="Chưa chọn" {...field} />
        <TextField label="Địa chỉ cơ sở" name="address" value={values.address} onChange={set("address")} maxLength={300} {...field} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Mã số thuế" name="taxCode" value={values.taxCode} onChange={set("taxCode")} maxLength={32} {...field} />
          <TextField label="Số giấy phép hoạt động" name="licenseNumber" value={values.licenseNumber} onChange={set("licenseNumber")} maxLength={80} {...field} />
        </div>
        <TextField
          label="Liên kết hồ sơ chứng minh (https)"
          name="licenseEvidenceUrl"
          value={values.licenseEvidenceUrl}
          onChange={set("licenseEvidenceUrl")}
          maxLength={1000}
          placeholder="https://…"
          {...field}
        />
        <p className="-mt-1 text-[12px] leading-relaxed text-brand-navy/45">
          Số giấy phép và liên kết hồ sơ chứng minh có thể bổ sung sau, nhưng <strong>thiếu một trong hai thì Admin
          chưa xác minh được</strong>.
        </p>
      </div>

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
        <Link href={ROUTES.yTeDoiTacLogin} className={`font-bold ${accent.text}`}>
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}

export function HealthLoginForm() {
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
      router.replace(ROUTES.yTeDoiTacDashboard);
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
        <div className="text-[32px]">🏥</div>
        <h1 className="mt-1 text-[18px] font-extrabold text-brand-navy">Đăng nhập cơ sở y tế</h1>
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
        <Link href={ROUTES.yTeDoiTac} className={`font-bold ${accent.text}`}>
          Đăng ký cơ sở y tế
        </Link>
      </p>
    </form>
  );
}
