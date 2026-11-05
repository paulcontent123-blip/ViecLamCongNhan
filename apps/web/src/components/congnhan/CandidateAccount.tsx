"use client";

// Màn "Tài khoản công nhân" trên web, theo `WorkerAccountScreen` của app: hồ sơ (xem/sửa), ảnh đại diện, đơn ứng
// tuyển, chia sẻ hồ sơ cho đơn vị đào tạo và chủ trọ, đăng xuất, xoá tài khoản. Không có điểm thưởng/quà (chỉ có
// trên app) và không dùng OTP.
//
// Quy tắc ghi giống app: lưu hồ sơ và lưu chia sẻ đều ghi rồi ĐỌC LẠI để xác nhận; kết quả chưa rõ thì khoá nút
// cho tới khi tải lại, không bao giờ tự gửi lại.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import { SelectField, TextField } from "@/components/dichvucongnhan/ui";
import { MobilePager, MobileStateCard, MobileTabs } from "@/components/shared/mobileUi";
import { isSessionExpired, messageOf, useMobileList } from "@/components/shared/useMobileList";
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_TONE,
  EMPTY_PROFILE,
  HOUSING_OPTIONS,
  SHIFT_OPTIONS,
  profileBody,
  profileErrors,
  profileToValues,
  type ProfileValues,
} from "@/lib/candidate-account";
import {
  CandidateFieldError,
  deleteAccount,
  getAvatar,
  getConsent,
  getProfile,
  getSession,
  listApplications,
  logout,
  saveProfile,
  setConsent,
  uploadAvatar,
  type CandidateProfile,
  type CandidateSession,
  type ConsentKind,
} from "@/lib/candidate-account-client";
import { formatDate } from "@/lib/format-date";
import { industryLabel, JOB_INDUSTRIES } from "@/lib/industries";
import { MobileApiError } from "@/lib/mobile-session-client";
import { PORTAL_ACCENT as accent } from "@/lib/portal-accent";
import { PROVINCES, provinceName } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";
import { displayProvince } from "@/lib/worker-services";

type Section = "profile" | "applications" | "sharing";

const SECTIONS: { value: Section; label: string }[] = [
  { value: "profile", label: "Hồ sơ" },
  { value: "applications", label: "Ứng tuyển" },
  { value: "sharing", label: "Chia sẻ hồ sơ" },
];

const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));
const INDUSTRY_OPTIONS = JOB_INDUSTRIES.map((industry) => ({ value: industry.value, label: industry.label }));
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Giá trị đã lưu có thể là chữ tự do (dữ liệu cũ); giữ lại thành một lựa chọn để không mất khi sửa. */
function withCurrent(options: { value: string; label: string }[], current: string, label: string) {
  return current && !options.some((option) => option.value === current) ? [{ value: current, label }, ...options] : options;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/5 py-2.5 last:border-b-0">
      <dt className="text-[12.5px] text-brand-navy/50">{label}</dt>
      <dd className="text-right text-[13px] font-semibold text-brand-navy">{value || "Chưa cập nhật"}</dd>
    </div>
  );
}

function Banner({ tone, children }: { tone: "ok" | "warn" | "error"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "warn"
        ? "bg-amber-50 text-amber-800"
        : "bg-red-50 text-red-700";
  return (
    <div className={`rounded-lg px-3.5 py-2.5 text-[12.5px] font-medium leading-relaxed ${cls}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function CandidateAccount() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("profile");
  const [session, setSession] = useState<CandidateSession | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  /** Kết quả ghi chưa rõ: khoá các nút ghi cho tới khi tải lại. */
  const [needsReload, setNeedsReload] = useState("");

  const toLogin = useCallback(() => router.replace(ROUTES.congNhanLogin), [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const current = await getSession();
      if (!current.loggedIn) {
        toLogin();
        return;
      }
      setSession(current);
      setProfile(await getProfile());
      // Ảnh đại diện hỏng thì bỏ qua, không chặn cả màn.
      setAvatarUrl(await getAvatar().catch(() => null));
      setNeedsReload("");
    } catch (err) {
      if (isSessionExpired(err)) {
        toLogin();
        return;
      }
      setLoadError(messageOf(err, "Chưa tải được tài khoản."));
    } finally {
      setLoading(false);
    }
  }, [toLogin]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !profile) return <MobileStateCard tone="loading" title="Đang tải tài khoản công nhân…" />;
  if (loadError && !profile) {
    return <MobileStateCard tone="error" title="Chưa tải được tài khoản" description={loadError} onRetry={load} />;
  }
  if (!profile || !session) return null;

  return (
    <div className="flex flex-col gap-4">
      <Hero
        profile={profile}
        session={session}
        avatarUrl={avatarUrl}
        onAvatar={setAvatarUrl}
        locked={Boolean(needsReload)}
        onUncertain={setNeedsReload}
        onExpired={toLogin}
      />

      {!session.phoneVerified && (
        <Banner tone="warn">
          Số điện thoại chưa được xác minh. Bạn vẫn sửa được hồ sơ, đổi ảnh đại diện và theo dõi đơn ứng tuyển; chia sẻ
          hồ sơ cho đối tác sẽ mở sau khi tài khoản được xác minh.
        </Banner>
      )}

      {needsReload && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-medium text-amber-800" role="alert">
          <span>⚠️ {needsReload}</span>
          <button type="button" onClick={load} className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-bold text-white">
            Tải lại
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={ROUTES.congNhanMatches} className="rounded-xl border border-black/10 bg-white px-4 py-2 text-[12.5px] font-bold text-brand-navy/70 transition hover:border-brand-orange hover:text-brand-orange">
          ✨ Gợi ý cho bạn
        </Link>
        <Link href={ROUTES.congNhanSaved} className="rounded-xl border border-black/10 bg-white px-4 py-2 text-[12.5px] font-bold text-brand-navy/70 transition hover:border-brand-orange hover:text-brand-orange">
          ❤️ Việc đã lưu
        </Link>
      </div>

      <MobileTabs tabs={SECTIONS} active={section} onChange={setSection} />

      {section === "profile" && (
        <ProfileCard
          profile={profile}
          session={session}
          locked={Boolean(needsReload)}
          onSaved={setProfile}
          onUncertain={setNeedsReload}
          onExpired={toLogin}
        />
      )}
      {section === "applications" && <Applications onExpired={toLogin} />}
      {section === "sharing" && (
        <Sharing verified={session.phoneVerified} locked={Boolean(needsReload)} onUncertain={setNeedsReload} onExpired={toLogin} />
      )}

      <DangerZone locked={Boolean(needsReload)} onUncertain={setNeedsReload} onExpired={toLogin} />
    </div>
  );
}

// ───────── Đầu trang: ảnh đại diện + số liệu ─────────

function Hero({
  profile,
  session,
  avatarUrl,
  onAvatar,
  locked,
  onUncertain,
  onExpired,
}: {
  profile: CandidateProfile;
  session: CandidateSession;
  avatarUrl: string | null;
  onAvatar: (url: string) => void;
  locked: boolean;
  onUncertain: (message: string) => void;
  onExpired: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [broken, setBroken] = useState(false);
  const years = typeof profile.experienceYears === "number" ? `${profile.experienceYears} năm` : "Chưa cập nhật";

  async function pick(file: File | undefined) {
    if (!file || busy || locked) return;
    setError("");
    setNotice("");
    if (!AVATAR_TYPES.includes(file.type)) {
      setError("Chọn ảnh JPG, PNG hoặc WEBP.");
    } else if (file.size > AVATAR_MAX_BYTES) {
      setError("Ảnh tối đa 5MB.");
    } else {
      setBusy(true);
      try {
        onAvatar(await uploadAvatar(file));
        setBroken(false);
        setNotice("Đã cập nhật ảnh đại diện.");
      } catch (err) {
        if (isSessionExpired(err)) {
          onExpired();
          return;
        }
        setError(messageOf(err, "Chưa tải được ảnh đại diện."));
        if (err instanceof MobileApiError && err.uncertain) onUncertain(messageOf(err, "Chưa xác định ảnh đã lưu hay chưa."));
      } finally {
        setBusy(false);
      }
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-orange to-brand-orange-2 p-5 text-white sm:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-[28px] font-extrabold">
          {avatarUrl && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh từ kho lưu trữ ngoài, không qua tối ưu hoá của Next
            <img src={avatarUrl} alt="Ảnh đại diện" className="h-full w-full object-cover" onError={() => setBroken(true)} />
          ) : (
            (text(profile.fullName) || session.fullName || "CN").trim().slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">Hồ sơ công nhân</div>
          <h1 className="truncate text-[20px] font-extrabold">{text(profile.fullName) || "Công nhân"}</h1>
          <p className="mt-0.5 text-[12.5px] text-white/75">{profile.phone}</p>
          <span
            className={`mt-1.5 inline-block rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ${
              session.phoneVerified ? "bg-[#DBF7E8] text-[#146C43]" : "bg-amber-100 text-amber-800"
            }`}
          >
            {session.phoneVerified ? "SĐT đã xác minh" : "SĐT chưa xác minh"}
          </span>
        </div>
        <div>
          <input
            ref={input}
            type="file"
            accept={AVATAR_TYPES.join(",")}
            disabled={busy || locked}
            onChange={(event) => pick(event.target.files?.[0])}
            className="hidden"
            id="candidate-avatar"
          />
          <label
            htmlFor="candidate-avatar"
            className={`inline-block cursor-pointer rounded-xl bg-white/15 px-4 py-2 text-[12.5px] font-bold transition hover:bg-white/25 ${busy || locked ? "pointer-events-none opacity-50" : ""}`}
          >
            {busy ? "Đang tải ảnh…" : avatarUrl ? "Đổi ảnh đại diện" : "Chọn ảnh đại diện"}
          </label>
          <p className="mt-1 text-[11px] text-white/60">JPG, PNG hoặc WEBP · tối đa 5MB</p>
        </div>
      </div>
      {error && <p className="mt-3 rounded-lg bg-white/15 px-3 py-2 text-[12.5px] font-medium" role="alert">{error}</p>}
      {notice && <p className="mt-3 rounded-lg bg-white/15 px-3 py-2 text-[12.5px] font-medium" role="status">{notice}</p>}

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {[
          { label: "Kinh nghiệm", value: years },
          { label: "Ngành nghề", value: industryLabel(text(profile.desiredIndustry)) || "Chưa chọn" },
          { label: "Tỉnh/thành", value: displayProvince(text(profile.province), provinceName) || "Chưa chọn" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-white/10 px-3 py-2.5">
            <div className="text-[11px] text-white/60">{item.label}</div>
            <div className="mt-0.5 truncate text-[13px] font-bold">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────── Hồ sơ ─────────

function ProfileCard({
  profile,
  session,
  locked,
  onSaved,
  onUncertain,
  onExpired,
}: {
  profile: CandidateProfile;
  session: CandidateSession;
  locked: boolean;
  onSaved: (profile: CandidateProfile) => void;
  onUncertain: (message: string) => void;
  onExpired: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ProfileValues>(() => ({ ...EMPTY_PROFILE, ...profileToValues(profile) }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: keyof ProfileValues) => (value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setError("");
  };

  const stored = profileToValues(profile);
  const off = busy || locked;

  function cancel() {
    setValues({ ...EMPTY_PROFILE, ...stored });
    setFieldErrors({});
    setError("");
    setEditing(false);
  }

  async function save() {
    if (off) return;
    const local = profileErrors(values);
    if (Object.keys(local).length) {
      setFieldErrors(local as Record<string, string>);
      setError("Vui lòng sửa các trường được đánh dấu.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await saveProfile(profileBody(values), values);
      onSaved(saved);
      setValues({ ...EMPTY_PROFILE, ...profileToValues(saved) });
      setEditing(false);
      setNotice("Đã cập nhật hồ sơ.");
    } catch (err) {
      if (isSessionExpired(err)) {
        onExpired();
        return;
      }
      if (err instanceof CandidateFieldError) setFieldErrors(err.fieldErrors);
      setError(messageOf(err, "Chưa lưu được hồ sơ."));
      if (err instanceof MobileApiError && err.uncertain) onUncertain(messageOf(err, "Chưa xác định hồ sơ đã lưu hay chưa."));
    } finally {
      setBusy(false);
    }
  }

  const provinceOptions = withCurrent(PROVINCE_OPTIONS, values.province, values.province);
  const industryOptions = withCurrent(INDUSTRY_OPTIONS, values.desiredIndustry, values.desiredIndustry);
  const fieldError = (key: keyof ProfileValues) =>
    fieldErrors[key] ? <p className="mt-1 text-[12px] font-medium text-red-600">{fieldErrors[key]}</p> : null;

  if (!editing) {
    return (
      <div className="rounded-xl border border-black/5 bg-white p-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-extrabold text-brand-navy">Hồ sơ của tôi</h2>
          <button
            type="button"
            disabled={locked}
            onClick={() => {
              setNotice("");
              setEditing(true);
            }}
            className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold ${accent.button} disabled:opacity-50`}
          >
            Chỉnh sửa
          </button>
        </div>
        {notice && <Banner tone="ok">{notice}</Banner>}
        <dl className="mt-1">
          <Row label="Họ và tên" value={text(profile.fullName)} />
          <Row label="Số điện thoại" value={`${profile.phone}${session.phoneVerified ? " · đã xác minh" : " · chưa xác minh"}`} />
          <Row label="Ngày sinh" value={stored.dateOfBirth ? formatDate(stored.dateOfBirth) : ""} />
          <Row label="Zalo" value={stored.zalo} />
          <Row label="Tỉnh/thành" value={displayProvince(stored.province, provinceName) ?? ""} />
          <Row label="Ngành nghề mong muốn" value={industryLabel(stored.desiredIndustry)} />
          <Row
            label="Lương tối thiểu mong muốn"
            value={stored.desiredSalaryMin ? `${Number(stored.desiredSalaryMin).toLocaleString("vi-VN")}đ/tháng` : ""}
          />
          <Row label="Số năm kinh nghiệm" value={stored.experienceYears ? `${stored.experienceYears} năm` : ""} />
          <Row label="Ca làm mong muốn" value={SHIFT_OPTIONS.find((option) => option.value === stored.preferredShift)?.label ?? ""} />
          <Row label="Cần hỗ trợ nhà ở" value={HOUSING_OPTIONS.find((option) => option.value === stored.needsHousing)?.label ?? ""} />
        </dl>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-black/5 bg-white p-5">
      <h2 className="mb-3 text-[15px] font-extrabold text-brand-navy">Chỉnh sửa hồ sơ</h2>
      <div className="flex flex-col gap-3.5">
        <div>
          <TextField label="Họ và tên *" name="fullName" value={values.fullName} onChange={set("fullName")} maxLength={100} disabled={off} accent={accent} />
          {fieldError("fullName")}
        </div>
        <TextField label="Số điện thoại (không đổi được)" name="phone" value={text(profile.phone)} onChange={() => {}} disabled accent={accent} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <TextField label="Ngày sinh" name="dateOfBirth" type="date" value={values.dateOfBirth} onChange={set("dateOfBirth")} disabled={off} accent={accent} />
            {fieldError("dateOfBirth")}
          </div>
          <div>
            <TextField label="Zalo" name="zalo" type="tel" inputMode="tel" value={values.zalo} onChange={set("zalo")} maxLength={24} disabled={off} accent={accent} />
            {fieldError("zalo")}
          </div>
        </div>
        <div>
          <SelectField label="Tỉnh/thành" name="province" value={values.province} onChange={set("province")} options={provinceOptions} placeholder="Chưa chọn" disabled={off} accent={accent} />
          {fieldError("province")}
        </div>

        <h3 className="pt-1 text-[13px] font-extrabold text-brand-navy">Mong muốn công việc</h3>
        <div>
          <SelectField label="Ngành nghề mong muốn" name="desiredIndustry" value={values.desiredIndustry} onChange={set("desiredIndustry")} options={industryOptions} placeholder="Chưa chọn" disabled={off} accent={accent} />
          {fieldError("desiredIndustry")}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <TextField
              label="Lương tối thiểu (đồng/tháng)"
              name="desiredSalaryMin"
              inputMode="numeric"
              value={values.desiredSalaryMin}
              onChange={(v) => set("desiredSalaryMin")(v.replace(/\D/g, ""))}
              disabled={off}
              accent={accent}
            />
            {fieldError("desiredSalaryMin")}
          </div>
          <div>
            <TextField
              label="Số năm kinh nghiệm"
              name="experienceYears"
              inputMode="numeric"
              value={values.experienceYears}
              onChange={(v) => set("experienceYears")(v.replace(/\D/g, ""))}
              disabled={off}
              accent={accent}
            />
            {fieldError("experienceYears")}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <SelectField label="Ca làm mong muốn" name="preferredShift" value={values.preferredShift} onChange={set("preferredShift")} options={SHIFT_OPTIONS} placeholder="Chưa chọn" disabled={off} accent={accent} />
            {fieldError("preferredShift")}
          </div>
          <div>
            <SelectField label="Nhu cầu hỗ trợ nhà ở" name="needsHousing" value={values.needsHousing} onChange={set("needsHousing")} options={HOUSING_OPTIONS} placeholder="Chưa trả lời" disabled={off} accent={accent} />
            {fieldError("needsHousing")}
          </div>
        </div>

        {error && <Banner tone="error">{error}</Banner>}

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" disabled={off} onClick={save} className={`rounded-xl px-6 py-2.5 text-[13.5px] font-extrabold transition disabled:opacity-50 ${accent.button}`}>
            {busy ? "Đang lưu…" : "Lưu hồ sơ"}
          </button>
          <button type="button" disabled={busy} onClick={cancel} className="rounded-xl border border-black/10 px-5 py-2.5 text-[13px] font-bold text-brand-navy/50">
            Hủy sửa
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────── Đơn ứng tuyển ─────────

function Applications({ onExpired }: { onExpired: () => void }) {
  const list = useMobileList((params) => listApplications(params), {}, { onSessionExpired: onExpired });

  return (
    <div className="rounded-xl border border-black/5 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-extrabold text-brand-navy">Đơn ứng tuyển{list.loaded ? ` (${list.total})` : ""}</h2>
        <Link href={ROUTES.timViecLam} className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-bold ${accent.button}`}>
          Tìm việc mới
        </Link>
      </div>

      {list.error && (
        <MobileStateCard
          tone="error"
          title="Chưa tải được đơn ứng tuyển"
          description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
          onRetry={list.reload}
        />
      )}
      {list.loading && !list.items.length && !list.error && <MobileStateCard tone="loading" title="Đang tải đơn ứng tuyển…" />}
      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <MobileStateCard tone="empty" title="Bạn chưa có đơn ứng tuyển nào" description="Tìm việc phù hợp và ứng tuyển để theo dõi trạng thái tại đây." />
      )}

      {list.items.length > 0 && (
        <div className="flex flex-col divide-y divide-black/5">
          {list.items.map((item) => {
            const job = (item.jobs ?? null) as { title?: unknown; slug?: unknown; province_code?: unknown; industry?: unknown } | null;
            const place = displayProvince(text(job?.province_code), provinceName);
            const meta = [place, industryLabel(text(job?.industry))].filter(Boolean).join(" · ");
            const slug = text(job?.slug);
            return (
              <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  {slug ? (
                    <Link href={`${ROUTES.timViecLam}/${slug}`} className="text-[13.5px] font-extrabold text-brand-navy hover:text-brand-orange">
                      {text(job?.title) || "Tin tuyển dụng"}
                    </Link>
                  ) : (
                    <div className="text-[13.5px] font-extrabold text-brand-navy">{text(job?.title) || "Tin tuyển dụng"}</div>
                  )}
                  {meta && <p className="mt-0.5 text-[12.5px] text-brand-navy/55">{meta}</p>}
                  {text(item.created_at) && <p className="mt-0.5 text-[11.5px] text-brand-navy/40">Ứng tuyển {formatDate(text(item.created_at))}</p>}
                </div>
                <StatusPill label={APPLICATION_STATUS_LABEL[item.status] ?? item.status} tone={APPLICATION_STATUS_TONE[item.status] ?? "gray"} />
              </div>
            );
          })}
        </div>
      )}

      <MobilePager list={list} unit="đơn" />
    </div>
  );
}

// ───────── Chia sẻ hồ sơ ─────────

const CONSENT_COPY: Record<ConsentKind, { title: string; target: string; warehouse: string; contact: string }> = {
  training: { title: "Chia sẻ với đơn vị đào tạo", target: "đơn vị đào tạo", warehouse: "Kho học viên", contact: "đơn vị" },
  rental: { title: "Chia sẻ với chủ trọ", target: "chủ trọ", warehouse: "Kho người thuê", contact: "chủ trọ" },
};

function ConsentCard({
  kind,
  verified,
  locked,
  onUncertain,
  onExpired,
}: {
  kind: ConsentKind;
  verified: boolean;
  locked: boolean;
  onUncertain: (message: string) => void;
  onExpired: () => void;
}) {
  const copy = CONSENT_COPY[kind];
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getConsent(kind)
      .then((value) => alive && setEnabled(value))
      .catch((err) => {
        if (!alive) return;
        if (isSessionExpired(err)) onExpired();
        else setError(messageOf(err, "Chưa tải được lựa chọn chia sẻ."));
      });
    return () => {
      alive = false;
    };
    // Chỉ tải một lần khi mở thẻ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  async function toggle() {
    if (enabled === null || busy || locked) return;
    const next = !enabled;
    const prompt = next
      ? `Cho phép ${copy.target} đã được xác minh xem hồ sơ tóm tắt của bạn (họ tên, tỉnh/thành, ngành nghề, lương mong muốn và kinh nghiệm). Số điện thoại/Zalo chỉ hiện khi ${copy.contact} dùng lượt mở liên hệ theo gói của họ. Bạn có thể tắt bất cứ lúc nào.`
      : `Tắt chia sẻ sẽ ẩn hồ sơ của bạn khỏi ${copy.warehouse} và chặn việc mở thông tin liên hệ mới.`;
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setError("");
    try {
      setEnabled(await setConsent(kind, next));
    } catch (err) {
      if (isSessionExpired(err)) {
        onExpired();
        return;
      }
      setError(messageOf(err, "Chưa lưu được lựa chọn chia sẻ."));
      if (err instanceof MobileApiError && err.uncertain) onUncertain(messageOf(err, "Chưa xác định lựa chọn chia sẻ đã lưu hay chưa."));
    } finally {
      setBusy(false);
    }
  }

  // Chưa xác minh thì không bật được (máy chủ cũng chặn), nhưng vẫn tắt được nếu trước đó đã bật.
  const blocked = !verified && enabled !== true;

  return (
    <div className="rounded-xl border border-black/5 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[15px] font-extrabold text-brand-navy">{copy.title}</h2>
        <button
          type="button"
          role="switch"
          aria-checked={enabled === true}
          aria-label={copy.title}
          disabled={enabled === null || busy || locked || blocked}
          onClick={toggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${enabled ? "bg-brand-orange" : "bg-black/20"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-brand-navy/60">
        Khi bật, hồ sơ của bạn có thể xuất hiện trong {copy.warehouse} của {copy.target} đã được Admin xác minh. Họ xem được họ tên,
        tỉnh/thành, ngành nghề, lương mong muốn và kinh nghiệm. Số điện thoại/Zalo chỉ hiện sau khi {copy.contact} mở liên hệ theo
        hạn mức gói.
      </p>
      <p className="mt-2 text-[12.5px] font-semibold text-brand-navy/70">
        {blocked
          ? "Cần xác minh số điện thoại để bật chia sẻ hồ sơ."
          : enabled === null
            ? error
              ? ""
              : "Đang tải lựa chọn…"
            : enabled
              ? `Đang cho phép chia sẻ · Bạn có thể tắt bất cứ lúc nào.`
              : `Chưa chia sẻ hồ sơ với ${copy.target}.`}
        {busy ? " Đang lưu lựa chọn…" : ""}
      </p>
      {error && (
        <div className="mt-2">
          <Banner tone="error">{error}</Banner>
        </div>
      )}
    </div>
  );
}

function Sharing(props: { verified: boolean; locked: boolean; onUncertain: (message: string) => void; onExpired: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <ConsentCard kind="training" {...props} />
      <ConsentCard kind="rental" {...props} />
    </div>
  );
}

// ───────── Đăng xuất / xoá tài khoản ─────────

function DangerZone({
  locked,
  onUncertain,
  onExpired,
}: {
  locked: boolean;
  onUncertain: (message: string) => void;
  onExpired: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "logout" | "delete">("");
  const [error, setError] = useState("");

  async function doLogout() {
    if (busy) return;
    setBusy("logout");
    setError("");
    try {
      await logout();
      router.replace(ROUTES.congNhanLogin);
      router.refresh();
    } catch (err) {
      setError(messageOf(err, "Đăng xuất chưa thành công."));
      setBusy("");
    }
  }

  async function doDelete() {
    if (busy || locked) return;
    const ok = window.confirm(
      "Xóa tài khoản công nhân?\n\nHồ sơ, ảnh đại diện, đơn ứng tuyển và các dữ liệu gắn với tài khoản sẽ bị xóa, không thể khôi phục. Yêu cầu bạn đã gửi cho đối tác vẫn được đối tác giữ nhưng không còn gắn với tài khoản. Bạn chưa xóa được nếu còn yêu cầu đổi quà đang chờ xử lý.",
    );
    if (!ok) return;
    setBusy("delete");
    setError("");
    try {
      await deleteAccount();
      router.replace(ROUTES.congNhanLogin);
      router.refresh();
    } catch (err) {
      if (isSessionExpired(err)) {
        onExpired();
        return;
      }
      setError(messageOf(err, "Chưa xóa được tài khoản."));
      if (err instanceof MobileApiError && err.uncertain) onUncertain(messageOf(err, "Chưa xác định tài khoản đã xóa hay chưa."));
      setBusy("");
    }
  }

  return (
    <div className="rounded-xl border border-black/5 bg-white p-5">
      {error && (
        <div className="mb-3">
          <Banner tone="error">{error}</Banner>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={doLogout}
          className="rounded-xl border border-black/10 px-5 py-2.5 text-[13px] font-bold text-brand-navy/70 transition hover:border-brand-orange hover:text-brand-orange disabled:opacity-50"
        >
          {busy === "logout" ? "Đang đăng xuất…" : "Đăng xuất"}
        </button>
        <button
          type="button"
          disabled={Boolean(busy) || locked}
          onClick={doDelete}
          className="rounded-xl border border-red-200 px-5 py-2.5 text-[13px] font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
        >
          {busy === "delete" ? "Đang xóa…" : "Xóa tài khoản"}
        </button>
      </div>
    </div>
  );
}
