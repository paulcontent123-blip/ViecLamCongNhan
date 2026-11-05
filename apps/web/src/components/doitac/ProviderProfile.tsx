"use client";

// Màn Hồ sơ dùng chung cho Bảo hiểm, Tài chính và Thuê trọ: form dựng theo cấu hình ô nhập, tải logo, và lưu hồ sơ
// theo quy tắc của app ‑ ghi rồi ĐỌC LẠI để xác nhận, không bao giờ tự gửi lại khi kết quả chưa rõ.
// Phần riêng của từng cổng (ví dụ tải hồ sơ giấy phép của Tài chính) gắn vào qua `renderExtra`.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FieldGrid, type FieldDef, type ProviderAccent } from "@/components/doitac/FieldGrid";
import { PortalHeading } from "@/components/doitac/PortalChrome";
import { MobileStateCard } from "@/components/shared/mobileUi";
import { isSessionExpired, messageOf } from "@/components/shared/useMobileList";
import { MobileApiError } from "@/lib/mobile-session-client";
import type { Values } from "@/lib/provider-portal-common";

type Profile = Record<string, unknown> & { id: string; is_verified: boolean };

const text = (value: unknown) => (typeof value === "string" ? value : "");

export type ProfileExtraContext = {
  profile: Profile & { email: string };
  /** Tải lại hồ sơ từ máy chủ và đặt lại form. */
  reload: () => Promise<void>;
  setNotice: (message: string) => void;
  setError: (message: string) => void;
  /** Báo kết quả chưa xác định: khoá toàn bộ nút cho tới khi tải lại. */
  markUncertain: (message: string) => void;
  disabled: boolean;
};

export function ProviderProfile({
  loginHref,
  accent,
  title,
  description,
  fields,
  getProfile,
  saveProfile,
  toValues,
  validate,
  buildBody,
  matches,
  uploadLogo,
  logoAccept,
  logoHint,
  logoMaxBytes = 5 * 1024 * 1024,
  logoAlt,
  fileButtonClass,
  sideRows,
  banner,
  renderExtra,
  verificationLostMessage,
}: {
  loginHref: string;
  accent: ProviderAccent;
  title: string;
  description: string;
  fields: FieldDef[] | ((values: Values) => FieldDef[]);
  getProfile: () => Promise<Profile & { email: string }>;
  saveProfile: (body: Record<string, unknown>, matches: (latest: Profile) => boolean) => Promise<Profile & { email: string }>;
  toValues: (profile: Record<string, unknown>) => Values;
  validate: (values: Values) => string | null;
  buildBody: (values: Values) => Record<string, unknown>;
  matches: (latest: Record<string, unknown>, sent: Values) => boolean;
  uploadLogo: (file: File) => Promise<string>;
  /** Giá trị `accept` của ô chọn tệp logo, đúng các định dạng máy chủ nhận. */
  logoAccept: string;
  logoHint: string;
  logoMaxBytes?: number;
  logoAlt: string;
  /** Lớp màu của nút chọn tệp (Tailwind cần chuỗi nguyên văn). */
  fileButtonClass: string;
  sideRows: (profile: Profile & { email: string }) => { label: string; value: string }[];
  /** Khung lưu ý phía trên form (ví dụ thiếu giấy phép), tính từ hồ sơ và giá trị đang nhập. */
  banner?: (profile: Profile, values: Values) => React.ReactNode;
  renderExtra?: (ctx: ProfileExtraContext) => React.ReactNode;
  verificationLostMessage: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<(Profile & { email: string }) | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  /** Kết quả lưu chưa rõ: khoá nút cho tới khi tải lại, vì có thể đã lưu rồi. */
  const [needsReload, setNeedsReload] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const current = await getProfile();
      setProfile(current);
      setValues(toValues(current));
      setNeedsReload(false);
      setError("");
    } catch (err) {
      if (isSessionExpired(err)) {
        router.replace(loginHref);
        return;
      }
      setLoadError(messageOf(err, "Chưa tải được hồ sơ."));
    } finally {
      setLoading(false);
    }
    // Các hàm truyền vào được nơi gọi tạo mới mỗi lần render; chỉ tải lại khi đổi cổng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loginHref]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!values || busy || needsReload) return;
    const invalid = validate(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    const wasVerified = profile?.is_verified === true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const sent = values;
      const saved = await saveProfile(buildBody(sent), (latest) => matches(latest, sent));
      setProfile(saved);
      setValues(toValues(saved));
      // Đổi thông tin pháp lý có thể làm mất xác minh; nói rõ để không ngạc nhiên khi nút bị khoá.
      setNotice(wasVerified && !saved.is_verified ? verificationLostMessage : "Đã cập nhật hồ sơ.");
    } catch (err) {
      if (isSessionExpired(err)) {
        router.replace(loginHref);
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
    // Báo sớm thay vì chờ máy chủ từ chối một tệp lớn.
    if (file.size > logoMaxBytes) {
      setError(`Ảnh logo phải nhỏ hơn ${Math.round(logoMaxBytes / (1024 * 1024))}MB.`);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setLogoBusy(true);
    setError("");
    setNotice("");
    try {
      const url = await uploadLogo(file);
      setProfile((current) => (current ? { ...current, logo_url: url } : current));
      setNotice("Đã cập nhật logo.");
    } catch (err) {
      setError(messageOf(err, "Chưa tải được logo."));
      if (err instanceof MobileApiError && err.uncertain) setNeedsReload(true);
    } finally {
      setLogoBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  if (loading && !profile) return <MobileStateCard tone="loading" title="Đang tải hồ sơ…" />;
  if (loadError && !profile) {
    return <MobileStateCard tone="error" title="Chưa tải được hồ sơ" description={loadError} onRetry={load} />;
  }
  if (!profile || !values) return null;

  const off = busy || needsReload;
  const logo = text(profile.logo_url);
  const fieldList = typeof fields === "function" ? fields(values) : fields;

  return (
    <>
      <PortalHeading title={title} description={description} />

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
          {banner?.(profile, values)}

          <FieldGrid
            fields={fieldList}
            values={values}
            onChange={(key, value) => setValues((current) => (current ? { ...current, [key]: value } : current))}
            disabled={off}
            accent={accent}
          />

          {renderExtra?.({
            profile,
            reload: load,
            setNotice,
            setError,
            markUncertain: (message) => {
              setError(message);
              setNeedsReload(true);
            },
            disabled: off,
          })}

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
            <div className={`text-[12px] font-bold uppercase tracking-wider ${accent.text}`}>Logo</div>
            <div className="mt-3 flex h-[120px] items-center justify-center rounded-lg bg-[#f6f7f9]">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- dùng <img> như các phần ảnh từ xa khác của web
                <img src={logo} alt={logoAlt} className="max-h-[110px] max-w-full object-contain" />
              ) : (
                <span className="text-[12.5px] text-brand-navy/40">Chưa có logo</span>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept={logoAccept}
              disabled={logoBusy || needsReload}
              onChange={(event) => pickLogo(event.target.files?.[0])}
              className={`mt-3 block w-full text-[12px] text-brand-navy/60 file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-[12px] file:font-bold ${fileButtonClass}`}
            />
            <p className="mt-2 text-[11.5px] leading-relaxed text-brand-navy/45">{logoBusy ? "Đang tải logo lên…" : logoHint}</p>
          </div>

          <div className="rounded-xl border border-black/5 bg-white p-5 text-[12.5px] text-brand-navy/60">
            <div className={`text-[12px] font-bold uppercase tracking-wider ${accent.text}`}>Trạng thái tài khoản</div>
            <dl className="mt-3 flex flex-col gap-1.5">
              <div className="flex justify-between gap-2">
                <dt className="text-brand-navy/45">Xác minh</dt>
                <dd className="font-bold">{profile.is_verified ? "Đã xác minh" : "Chưa xác minh"}</dd>
              </div>
              {sideRows(profile).map((row) => (
                <div key={row.label} className="flex justify-between gap-2">
                  <dt className="text-brand-navy/45">{row.label}</dt>
                  <dd className="truncate font-bold">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
