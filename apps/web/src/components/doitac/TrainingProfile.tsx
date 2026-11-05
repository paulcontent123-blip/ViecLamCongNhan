"use client";

import { PORTAL_ACCENT } from "@/lib/portal-accent";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SelectField, TextAreaField, TextField } from "@/components/dichvucongnhan/ui";
import { MobileStateCard } from "@/components/shared/mobileUi";
import { PortalHeading } from "@/components/doitac/PortalChrome";
import { isSessionExpired, messageOf } from "@/components/shared/useMobileList";
import { formatDate } from "@/lib/format-date";
import { MobileApiError } from "@/lib/mobile-session-client";
import { PROVINCES } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";
import { getProfile, saveProfile, uploadLogo, type ProviderProfile } from "@/lib/training-provider-client";
import { profileBody, validateProfileForm, type ProfileFormValues } from "@/lib/training-provider-portal";
import { providerTypeLabel } from "@/lib/admin-partners";

const accent = PORTAL_ACCENT;
const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));
/** Máy chủ chỉ nhận ảnh; giữ cùng danh sách với màn app để người dùng không chọn nhầm định dạng. */
const LOGO_TYPES = "image/png,image/jpeg,image/webp,image/svg+xml";

const text = (value: unknown) => (typeof value === "string" ? value : "");

function toForm(profile: ProviderProfile): ProfileFormValues {
  return {
    providerName: text(profile.provider_name),
    contactName: text(profile.contact_name),
    contactPhone: text(profile.contact_phone),
    provinceCode: text(profile.province_code),
    taxCode: text(profile.tax_code),
    licenseNumber: text(profile.license_number),
    description: text(profile.description),
  };
}

export function TrainingProfile() {
  const router = useRouter();
  const [profile, setProfile] = useState<(ProviderProfile & { email: string }) | null>(null);
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
      setValues(toForm(current));
      setNeedsReload(false);
      setError("");
    } catch (err) {
      if (isSessionExpired(err)) {
        router.replace(ROUTES.hocNgheDoiTacLogin);
        return;
      }
      setLoadError(messageOf(err, "Chưa tải được hồ sơ đơn vị."));
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
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await saveProfile(values, profileBody(values));
      setProfile(result.profile);
      setValues(toForm(result.profile));
      setNotice(
        result.verificationRequired
          ? "Đã lưu hồ sơ. Đơn vị đang chờ Admin xác minh lại trước khi gửi khóa học."
          : "Đã cập nhật hồ sơ đơn vị đào tạo.",
      );
    } catch (err) {
      if (isSessionExpired(err)) {
        router.replace(ROUTES.hocNgheDoiTacLogin);
        return;
      }
      setError(messageOf(err, "Chưa cập nhật được hồ sơ."));
      if (err instanceof MobileApiError && err.uncertain) setNeedsReload(true);
    } finally {
      setBusy(false);
    }
  }

  async function pickLogo(file: File | undefined) {
    if (!file || logoBusy) return;
    setLogoBusy(true);
    setError("");
    setNotice("");
    try {
      const url = await uploadLogo(file);
      setProfile((current) => (current ? { ...current, logo_url: url } : current));
      setNotice("Đã cập nhật logo đơn vị đào tạo.");
    } catch (err) {
      setError(messageOf(err, "Chưa tải được logo."));
      if (err instanceof MobileApiError && err.uncertain) setNeedsReload(true);
    } finally {
      setLogoBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  if (loading && !profile) return <MobileStateCard tone="loading" title="Đang tải hồ sơ đơn vị…" />;
  if (loadError && !profile) {
    return <MobileStateCard tone="error" title="Chưa tải được hồ sơ đơn vị" description={loadError} onRetry={load} />;
  }
  if (!profile || !values) return null;

  const logo = text(profile.logo_url);

  return (
    <>
      <PortalHeading
        title="🏫 Thông tin đơn vị"
        description="Hồ sơ này hiển thị kèm khóa học của đơn vị. Sửa thông tin pháp lý có thể phải chờ Admin xác minh lại."
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
            <TextField label="Tên đơn vị *" name="providerName" value={values.providerName} onChange={set("providerName")} disabled={busy || needsReload} maxLength={160} accent={accent} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Người phụ trách *" name="contactName" value={values.contactName} onChange={set("contactName")} disabled={busy || needsReload} maxLength={120} accent={accent} />
              <TextField label="Số điện thoại *" name="contactPhone" type="tel" inputMode="tel" value={values.contactPhone} onChange={set("contactPhone")} disabled={busy || needsReload} maxLength={20} accent={accent} />
            </div>
            <SelectField label="Tỉnh/thành" name="provinceCode" value={values.provinceCode} onChange={set("provinceCode")} options={PROVINCE_OPTIONS} placeholder="Chưa chọn" disabled={busy || needsReload} accent={accent} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Mã số thuế" name="taxCode" value={values.taxCode} onChange={set("taxCode")} disabled={busy || needsReload} maxLength={32} accent={accent} />
              <TextField label="Số giấy phép / ủy quyền" name="licenseNumber" value={values.licenseNumber} onChange={set("licenseNumber")} disabled={busy || needsReload} maxLength={80} accent={accent} />
            </div>
            <TextAreaField label="Giới thiệu đơn vị" name="description" value={values.description} onChange={set("description")} disabled={busy || needsReload} rows={4} maxLength={2000} accent={accent} />
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
              disabled={busy || needsReload}
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
            <div className={`text-[12px] font-bold uppercase tracking-wider ${accent.text}`}>Logo đơn vị</div>
            <div className="mt-3 flex h-[120px] items-center justify-center rounded-lg bg-[#f6f7f9]">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- dùng <img> như các phần ảnh từ xa khác của web
                <img src={logo} alt="Logo đơn vị đào tạo" className="max-h-[110px] max-w-full object-contain" />
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
              {logoBusy ? "Đang tải logo lên…" : "Chọn ảnh PNG, JPG, WEBP hoặc SVG. Ảnh tải lên là lưu ngay."}
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
                <dt className="text-brand-navy/45">Loại hình</dt>
                <dd className="font-bold">{providerTypeLabel(text(profile.provider_type)) ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-brand-navy/45">Gói</dt>
                <dd className="font-bold">{String(profile.account_type ?? "free").toUpperCase()}</dd>
              </div>
              {text(profile.account_tier_expires_at) && (
                <div className="flex justify-between gap-2">
                  <dt className="text-brand-navy/45">Hạn gói</dt>
                  <dd className="font-bold">{formatDate(text(profile.account_tier_expires_at))}</dd>
                </div>
              )}
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
