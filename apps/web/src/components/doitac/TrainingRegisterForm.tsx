"use client";

import { PORTAL_ACCENT } from "@/lib/portal-accent";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SelectField, TextField } from "@/components/dichvucongnhan/ui";
import { PROVINCES } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";
import { register } from "@/lib/training-provider-client";
import { registerBody, validateRegisterForm, type RegisterFormValues } from "@/lib/training-provider-portal";
import { MobileApiError } from "@/lib/mobile-session-client";

const accent = PORTAL_ACCENT;
const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));

const EMPTY: RegisterFormValues = {
  providerName: "",
  contactName: "",
  contactPhone: "",
  email: "",
  password: "",
  provinceCode: "",
  taxCode: "",
  licenseNumber: "",
};

export function TrainingRegisterForm() {
  const router = useRouter();
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
        <h2 className="mt-2 text-[16px] font-extrabold text-emerald-800">Đã tạo tài khoản đơn vị đào tạo</h2>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-emerald-700">
          Đăng nhập bằng email vừa đăng ký để cập nhật hồ sơ. Admin cần xác minh đơn vị trước khi bạn gửi khóa
          học và mở liên hệ học viên.
        </p>
        <Link
          href={ROUTES.hocNgheDoiTacLogin}
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
          href={ROUTES.hocNgheDoiTacLogin}
          className={`mt-5 inline-block rounded-xl px-6 py-2.5 text-[13px] font-bold ${accent.button}`}
        >
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
      <h2 className="text-[16px] font-extrabold text-brand-navy">Đăng ký đơn vị đào tạo</h2>
      <p className="mt-1 text-[12.5px] text-brand-navy/50">
        Tài khoản dùng chung với app. Đăng ký xong, Admin sẽ xác minh trước khi đơn vị đăng khóa học.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <TextField
          label="Tên trung tâm / đơn vị đào tạo *"
          name="providerName"
          value={values.providerName}
          onChange={set("providerName")}
          disabled={locked}
          maxLength={160}
          accent={accent}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Người phụ trách *"
            name="contactName"
            value={values.contactName}
            onChange={set("contactName")}
            disabled={locked}
            maxLength={120}
            accent={accent}
          />
          <TextField
            label="Số điện thoại liên hệ *"
            name="contactPhone"
            type="tel"
            inputMode="tel"
            value={values.contactPhone}
            onChange={set("contactPhone")}
            disabled={locked}
            maxLength={20}
            accent={accent}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Email đăng nhập *"
            name="email"
            type="email"
            inputMode="email"
            value={values.email}
            onChange={set("email")}
            disabled={locked}
            maxLength={254}
            accent={accent}
          />
          <TextField
            label="Mật khẩu (tối thiểu 8 ký tự) *"
            name="password"
            type="password"
            value={values.password}
            onChange={set("password")}
            disabled={locked}
            maxLength={128}
            accent={accent}
          />
        </div>
        <SelectField
          label="Tỉnh/thành"
          name="provinceCode"
          value={values.provinceCode}
          onChange={set("provinceCode")}
          options={PROVINCE_OPTIONS}
          placeholder="Chưa chọn"
          disabled={locked}
          accent={accent}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Mã số thuế (nếu có)"
            name="taxCode"
            value={values.taxCode}
            onChange={set("taxCode")}
            disabled={locked}
            maxLength={32}
            accent={accent}
          />
          <TextField
            label="Số giấy phép / ủy quyền (nếu có)"
            name="licenseNumber"
            value={values.licenseNumber}
            onChange={set("licenseNumber")}
            disabled={locked}
            maxLength={80}
            accent={accent}
          />
        </div>
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
        <Link href={ROUTES.hocNgheDoiTacLogin} className={`font-bold ${accent.text}`}>
          Đăng nhập
        </Link>
      </p>
      <button
        type="button"
        onClick={() => router.push(ROUTES.hocNghe)}
        className="mt-1 w-full text-center text-[12px] text-brand-navy/40 hover:text-brand-orange"
      >
        Xem khóa học đang công khai →
      </button>
    </form>
  );
}
