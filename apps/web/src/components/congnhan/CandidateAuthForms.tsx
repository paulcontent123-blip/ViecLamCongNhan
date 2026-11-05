"use client";

// Đăng nhập và đăng ký tài khoản công nhân bằng số điện thoại + mật khẩu, giống `CandidatePasswordForm` của app.
// Không dùng OTP. Số điện thoại chưa xác minh vẫn dùng được tài khoản; chia sẻ hồ sơ sẽ mở khi tài khoản được xác minh.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SelectField, TextField } from "@/components/dichvucongnhan/ui";
import { loginWithPassword, registerWithPassword } from "@/lib/candidate-account-client";
import { loginError, registerError } from "@/lib/candidate-account";
import { MobileApiError } from "@/lib/mobile-session-client";
import { PORTAL_ACCENT as accent } from "@/lib/portal-accent";
import { PROVINCES } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";

const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));

type Mode = "login" | "register";

export function CandidateAuthForm({ initialMode = "login" }: { initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  /** Đăng ký chưa rõ kết quả: khoá nút đăng ký, vì gửi lại có thể tạo tài khoản trùng. */
  const [uncertain, setUncertain] = useState("");
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    if (busy) return;
    setMode(next);
    setError("");
    setUncertain("");
  }

  async function submit() {
    if (busy) return;
    const invalid =
      mode === "login" ? loginError(phone, password) : registerError({ fullName, phone, province, password });
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        await registerWithPassword({ fullName, phone, province, password });
      } else {
        await loginWithPassword(phone, password);
      }
      router.replace(ROUTES.congNhanAccount);
      router.refresh();
    } catch (err) {
      if (mode === "register" && err instanceof MobileApiError && err.uncertain) {
        setUncertain(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Chưa thực hiện được. Vui lòng thử lại.");
      }
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
        <div className="text-[34px]" aria-hidden="true">
          👷
        </div>
        <h1 className="mt-1 text-[19px] font-extrabold text-brand-navy">Tài khoản công nhân</h1>
        <p className="mt-1 text-[12.5px] text-brand-navy/50">
          Xem hồ sơ, theo dõi đơn ứng tuyển và quản lý chia sẻ hồ sơ.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-1.5 rounded-xl bg-[#f6f7f9] p-1">
        {(["login", "register"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => switchMode(value)}
            aria-pressed={mode === value}
            className={`rounded-lg py-2 text-[13px] font-bold transition ${
              mode === value ? "bg-white text-brand-orange shadow-sm" : "text-brand-navy/50"
            }`}
          >
            {value === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
        ))}
      </div>

      {uncertain ? (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-800" role="alert">
          {uncertain}
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`mt-3 block w-full rounded-xl py-2.5 text-[13px] font-bold ${accent.button}`}
          >
            Đi tới đăng nhập
          </button>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3.5">
          {mode === "register" && (
            <TextField label="Họ và tên *" name="fullName" value={fullName} onChange={setFullName} maxLength={100} disabled={busy} accent={accent} />
          )}
          <TextField
            label="Số điện thoại *"
            name="phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={setPhone}
            maxLength={14}
            placeholder="0912345678"
            disabled={busy}
            accent={accent}
          />
          {mode === "register" && (
            <SelectField
              label="Tỉnh/thành *"
              name="province"
              value={province}
              onChange={setProvince}
              options={PROVINCE_OPTIONS}
              placeholder="Chọn tỉnh/thành"
              disabled={busy}
              accent={accent}
            />
          )}
          <TextField
            label={mode === "register" ? "Mật khẩu * (tối thiểu 8 ký tự)" : "Mật khẩu *"}
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            maxLength={72}
            disabled={busy}
            accent={accent}
          />

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`rounded-xl py-3 text-[14px] font-extrabold transition disabled:opacity-50 ${accent.button}`}
          >
            {busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </button>

          {mode === "register" && (
            <p className="text-[11.5px] leading-relaxed text-brand-navy/45">
              Số điện thoại chưa được xác minh nên chia sẻ hồ sơ cho đối tác sẽ mở sau khi tài khoản được xác minh. Bạn vẫn
              sửa được hồ sơ, đổi ảnh đại diện và theo dõi đơn ứng tuyển.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
