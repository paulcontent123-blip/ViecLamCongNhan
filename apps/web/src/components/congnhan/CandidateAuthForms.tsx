"use client";

// Đăng ký tài khoản người lao động bằng số điện thoại + mật khẩu, giống `CandidatePasswordForm` của app. Không dùng OTP.
// Số điện thoại chưa được xác minh nên tài khoản phải chờ Admin xác nhận mới đăng nhập được trên web. Máy chủ đăng nhập
// sẵn sau khi đăng ký; web đăng xuất ngay để người dùng không ở trong trạng thái "đã đăng nhập" mà chưa vào được gì.

import Link from "next/link";
import { useState } from "react";
import { SelectField, TextField } from "@/components/dichvucongnhan/ui";
import { registerError } from "@/lib/candidate-account";
import { logout, registerWithPassword } from "@/lib/candidate-account-client";
import { MobileApiError } from "@/lib/mobile-session-client";
import { PORTAL_ACCENT as accent } from "@/lib/portal-accent";
import { PROVINCES } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";

const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));

export function CandidateRegisterForm() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  /** Đăng ký chưa rõ kết quả: khoá nút, vì gửi lại có thể tạo tài khoản trùng. */
  const [uncertain, setUncertain] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (busy) return;
    const invalid = registerError({ fullName, phone, province, password });
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await registerWithPassword({ fullName, phone, province, password });
      // Tài khoản chờ Admin xác nhận: bỏ phiên vừa được tạo. Lỗi đăng xuất không chặn việc báo thành công.
      await logout().catch(() => undefined);
      setDone(true);
    } catch (err) {
      if (err instanceof MobileApiError && err.uncertain) setUncertain(err.message);
      else setError(err instanceof Error ? err.message : "Chưa tạo được tài khoản. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="text-[34px]" aria-hidden="true">
          ✅
        </div>
        <h2 className="mt-2 text-[16px] font-extrabold text-emerald-800">Đã gửi đăng ký</h2>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-emerald-700">
          Tài khoản của bạn đang chờ Admin xác nhận. Sau khi được xác nhận, bạn đăng nhập bằng số điện thoại và mật khẩu vừa tạo.
        </p>
        <Link href={ROUTES.congNhanLogin} className={`mt-5 inline-block rounded-xl px-6 py-2.5 text-[13px] font-bold ${accent.button}`}>
          Về trang đăng nhập
        </Link>
      </div>
    );
  }

  if (uncertain) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center" role="alert">
        <div className="text-[34px]" aria-hidden="true">
          ⚠️
        </div>
        <h2 className="mt-2 text-[16px] font-extrabold text-amber-800">Chưa xác định tài khoản đã tạo hay chưa</h2>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-amber-800">{uncertain}</p>
        <Link href={ROUTES.congNhanLogin} className={`mt-5 inline-block rounded-xl px-6 py-2.5 text-[13px] font-bold ${accent.button}`}>
          Đi tới đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextField label="Họ và tên *" name="fullName" value={fullName} onChange={setFullName} maxLength={100} disabled={busy} accent={accent} />
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
      <SelectField label="Tỉnh/thành *" name="province" value={province} onChange={setProvince} options={PROVINCE_OPTIONS} placeholder="Chọn tỉnh/thành" disabled={busy} accent={accent} />
      <TextField label="Mật khẩu * (tối thiểu 8 ký tự)" name="password" type="password" value={password} onChange={setPassword} maxLength={72} disabled={busy} accent={accent} />

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700" role="alert">
          {error}
        </div>
      )}

      <button type="submit" disabled={busy} className={`rounded-xl py-3 text-[14px] font-extrabold transition disabled:opacity-50 ${accent.button}`}>
        {busy ? "Đang tạo tài khoản…" : "Đăng ký"}
      </button>

      <p className="text-[11.5px] leading-relaxed text-brand-navy/45">
        Tài khoản người lao động cần Admin xác nhận số điện thoại trước khi đăng nhập. Sau khi đăng ký bạn sẽ được báo đang chờ xác nhận.
      </p>
    </form>
  );
}
