"use client";

import { PORTAL_ACCENT } from "@/lib/portal-accent";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SelectField, TextAreaField, TextField } from "@/components/dichvucongnhan/ui";
import { PortalHeading } from "@/components/doitac/PortalChrome";
import { MobileStateCard } from "@/components/shared/mobileUi";
import { isSessionExpired, messageOf } from "@/components/shared/useMobileList";
import {
  getProfile,
  HealthApiError,
  saveProfile,
  uploadLogo,
  type HealthProfile as HealthProfileRow,
} from "@/lib/health-provider-client";
import {
  HEALTH_PROVIDER_TYPES,
  profileBody,
  profileToForm,
  validateProfileForm,
  type ProfileFormValues,
} from "@/lib/health-provider-portal";
import { PROVINCES } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";

const accent = PORTAL_ACCENT;
const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));
/** Máy chủ chỉ nhận PNG, JPG, WEBP tối đa 5MB (khác cổng Học nghề, nơi còn nhận SVG). */
const LOGO_TYPES = "image/png,image/jpeg,image/webp";
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

const text = (value: unknown) => (typeof value === "string" ? value : "");

export function HealthProfile() {
  const router = useRouter();
  const [profile, setProfile] = useState<(HealthProfileRow & { email: string }) | null>(null);
  const [values, setValues] = useState<ProfileFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  /** Kết quả lưu chưa rõ: khoá nút cho tới khi tải lại, vì có thể đã lưu rồi. */
  const [needsReload, setNeedsReload] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = (key: keyof ProfileFormValues) => (value: string) =>
    setValues((current) => (current ? { ...current, [key]: value } : current));

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const current = await getProfile();
      setProfile(current);
      setValues(profileToForm(current));
      setNeedsReload(false);
      setError("");
    } catch (err) {
      if (isSessionExpired(err)) {
        router.replace(ROUTES.yTeDoiTacLogin);
        return;
      }
      setLoadError(messageOf(err, "Chưa tải được hồ sơ cơ sở."));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!values || busy || needsReload) return;
    const invalid = validateProfileForm(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    const wasVerified = profile?.is_verified === true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await saveProfile(values, profileBody(values));
      setProfile(saved);
      setValues(profileToForm(saved));
      // Đổi thông tin pháp lý có thể làm mất xác minh; nói rõ để cơ sở không ngạc nhiên khi nút bị khoá.
      setNotice(
        wasVerified && !saved.is_verified
          ? "Đã lưu hồ sơ. Thay đổi thông tin pháp lý khiến cơ sở phải chờ Admin xác minh lại trước khi gửi dịch vụ."
          : "Đã cập nhật hồ sơ cơ sở y tế.",
      );
    } catch (err) {
      if (isSessionExpired(err)) {
        router.replace(ROUTES.yTeDoiTacLogin);
        return;
      }
      setError(messageOf(err, "Chưa cập nhật được hồ sơ."));
      if (err instanceof HealthApiError && err.uncertain) setNeedsReload(true);
    } finally {
      setBusy(false);
    }
  }

  async function pickLogo(file: File | undefined) {
    if (!file || logoBusy) return;
    // Báo sớm thay vì chờ máy chủ từ chối một tệp lớn.
    if (file.size > LOGO_MAX_BYTES) {
      setError("Ảnh logo phải nhỏ hơn 5MB.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setLogoBusy(true);
    setError("");
    setNotice("");
    try {
      const url = await uploadLogo(file);
      setProfile((current) => (current ? { ...current, logo_url: url } : current));
      setNotice("Đã cập nhật logo cơ sở y tế.");
    } catch (err) {
      setError(messageOf(err, "Chưa tải được logo."));
      if (err instanceof HealthApiError && err.uncertain) setNeedsReload(true);
    } finally {
      setLogoBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  if (loading && !profile) return <MobileStateCard tone="loading" title="Đang tải hồ sơ cơ sở…" />;
  if (loadError && !profile) {
    return <MobileStateCard tone="error" title="Chưa tải được hồ sơ cơ sở" description={loadError} onRetry={load} />;
  }
  if (!profile || !values) return null;

  const logo = text(profile.logo_url);
  const off = busy || needsReload;
  const missingLicense = !values.licenseNumber.trim() || !values.licenseEvidenceUrl.trim();
  const limit = typeof profile.contact_view_limit === "number" ? profile.contact_view_limit : 0;
  const typeLabel = HEALTH_PROVIDER_TYPES.find((option) => option.value === text(profile.provider_type))?.label;

  return (
    <>
      <PortalHeading
        title="🏥 Hồ sơ cơ sở"
        description="Thông tin pháp lý, liên hệ và logo. Sửa thông tin pháp lý có thể phải chờ Admin xác minh lại."
      />

      {needsReload && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-medium text-amber-800" role="alert">
          <span>⚠️ {error || "Chưa xác định được thay đổi đã lưu hay chưa."}</span>
          <button type="button" onClick={load} className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-bold text-white">
            Tải lại hồ sơ
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="rounded-xl border border-black/5 bg-white p-5">
          <div className="flex flex-col gap-3">
            <TextField label="Tên cơ sở *" name="providerName" value={values.providerName} onChange={set("providerName")} disabled={off} maxLength={160} accent={accent} />
            <SelectField label="Loại cơ sở *" name="providerType" value={values.providerType} onChange={set("providerType")} options={HEALTH_PROVIDER_TYPES} disabled={off} accent={accent} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Người phụ trách *" name="contactName" value={values.contactName} onChange={set("contactName")} disabled={off} maxLength={120} accent={accent} />
              <TextField label="Số điện thoại *" name="contactPhone" type="tel" inputMode="tel" value={values.contactPhone} onChange={set("contactPhone")} disabled={off} maxLength={20} accent={accent} />
            </div>
            <SelectField label="Tỉnh/thành" name="provinceCode" value={values.provinceCode} onChange={set("provinceCode")} options={PROVINCE_OPTIONS} placeholder="Chưa chọn" disabled={off} accent={accent} />
            <TextField label="Địa chỉ cơ sở" name="address" value={values.address} onChange={set("address")} disabled={off} maxLength={300} accent={accent} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Mã số thuế" name="taxCode" value={values.taxCode} onChange={set("taxCode")} disabled={off} maxLength={32} accent={accent} />
              <TextField label="Số giấy phép hoạt động" name="licenseNumber" value={values.licenseNumber} onChange={set("licenseNumber")} disabled={off} maxLength={80} accent={accent} />
            </div>
            <TextField
              label="Liên kết hồ sơ chứng minh (https)"
              name="licenseEvidenceUrl"
              value={values.licenseEvidenceUrl}
              onChange={set("licenseEvidenceUrl")}
              disabled={off}
              maxLength={1000}
              placeholder="https://…"
              accent={accent}
            />
            {!profile.is_verified && missingLicense && (
              <p className="-mt-1 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
                Admin chỉ xác minh khi có <strong>cả số giấy phép lẫn liên kết hồ sơ chứng minh</strong>.
              </p>
            )}
            <TextAreaField label="Giới thiệu cơ sở" name="description" value={values.description} onChange={set("description")} disabled={off} rows={4} maxLength={2000} accent={accent} />
          </div>

          {notice && (
            <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-[12.5px] font-medium text-emerald-800" role="status">
              {notice}
            </div>
          )}
          {error && !needsReload && (
            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700" role="alert">
              {error}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={off}
              onClick={save}
              className={`rounded-xl px-5 py-2.5 text-[13.5px] font-extrabold transition disabled:opacity-50 ${accent.button}`}
            >
              {busy ? "Đang lưu…" : "Lưu thông tin"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={load}
              className="rounded-xl border border-black/10 px-5 py-2.5 text-[13px] font-bold text-brand-navy/50"
            >
              Bỏ thay đổi
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-black/5 bg-white p-5">
            <div className={`text-[12px] font-bold uppercase tracking-wider ${accent.text}`}>Logo cơ sở</div>
            <div className="mt-3 flex h-[120px] items-center justify-center rounded-lg bg-[#f6f7f9]">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- dùng <img> như các phần ảnh từ xa khác của web
                <img src={logo} alt="Logo cơ sở y tế" className="max-h-[110px] max-w-full object-contain" />
              ) : (
                <span className="text-[12.5px] text-brand-navy/40">Chưa có logo</span>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept={LOGO_TYPES}
              disabled={logoBusy || needsReload}
              onChange={(event) => pickLogo(event.target.files?.[0])}
              className="mt-3 block w-full text-[12px] text-brand-navy/60 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-orange-light file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-brand-orange"
            />
            <p className="mt-2 text-[11.5px] leading-relaxed text-brand-navy/45">
              {logoBusy ? "Đang tải logo lên…" : "Chọn ảnh PNG, JPG hoặc WEBP, dưới 5MB. Ảnh tải lên là lưu ngay."}
            </p>
          </div>

          <div className="rounded-xl border border-black/5 bg-white p-5 text-[12.5px] text-brand-navy/60">
            <div className={`text-[12px] font-bold uppercase tracking-wider ${accent.text}`}>Trạng thái tài khoản</div>
            <dl className="mt-3 flex flex-col gap-1.5">
              <div className="flex justify-between gap-2">
                <dt className="text-brand-navy/45">Xác minh</dt>
                <dd className="font-bold">{profile.is_verified ? "Đã xác minh" : "Chưa xác minh"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-brand-navy/45">Loại cơ sở</dt>
                <dd className="font-bold">{typeLabel ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-brand-navy/45">Hạn mức liên hệ</dt>
                <dd className="font-bold">{limit.toLocaleString("vi-VN")} lượt/tháng</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-brand-navy/45">Email</dt>
                <dd className="truncate font-bold">{profile.email || "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
