"use client";

// "Gợi ý cho bạn" (AI Matching) trên web, theo `AiMatchingScreen` và `MatchPreferencesScreen` của app.
// Backend lọc quyền và chấm điểm; web chỉ hiển thị và để người dùng tự quyết định xem, lưu hoặc ứng tuyển.
// Họ tên, số điện thoại, Zalo và lịch sử ứng tuyển không dùng để gợi ý.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SelectField } from "@/components/dichvucongnhan/ui";
import { MobileStateCard, MobileTabs } from "@/components/shared/mobileUi";
import { isSessionExpired, messageOf } from "@/components/shared/useMobileList";
import { JobCard } from "@/components/timviec/JobCard";
import {
  JOB_REASON_LABELS,
  MISSING_FIELD_LABELS,
  SERVICE_ICON,
  SERVICE_OPTIONS,
  SERVICE_REASON_LABELS,
  matchBand,
  reasonLabels,
  type MatchService,
} from "@/lib/candidate-matching";
import {
  getMatches,
  getPreferences,
  listKcn,
  updatePreferences,
  type MatchPreferences,
  type MatchResult,
} from "@/lib/candidate-matching-client";
import { MobileApiError } from "@/lib/mobile-session-client";
import { PORTAL_ACCENT as accent } from "@/lib/portal-accent";
import { PROVINCES } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";

type Tab = "matches" | "preferences";

const TABS: { value: Tab; label: string }[] = [
  { value: "matches", label: "✨ Gợi ý" },
  { value: "preferences", label: "Tùy chọn gợi ý" },
];

const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));
const BAND_CLASS = {
  high: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-black/5 text-brand-navy/60",
};

export function CandidateMatches() {
  const [tab, setTab] = useState<Tab>("matches");
  // Đổi tùy chọn xong thì lần mở lại tab Gợi ý phải tải lại.
  const [stale, setStale] = useState(0);

  return (
    <>
      <div className="mb-4">
        <h1 className="text-[20px] font-extrabold text-brand-navy">✨ Gợi ý cho bạn</h1>
        <p className="mt-1 text-[12.5px] text-brand-navy/55">
          Việc làm và dịch vụ phù hợp với hồ sơ của bạn. Bạn tự quyết định xem, lưu hoặc ứng tuyển.
        </p>
      </div>
      <MobileTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === "matches" ? <Matches key={stale} onOpenPreferences={() => setTab("preferences")} /> : <Preferences onSaved={() => { setStale((n) => n + 1); setTab("matches"); }} />}
    </>
  );
}

function Matches({ onOpenPreferences }: { onOpenPreferences: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<MatchResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      setData(await getMatches());
    } catch (err) {
      if (isSessionExpired(err)) {
        router.replace(ROUTES.congNhanLogin);
        return;
      }
      // Quá giới hạn (429) hoặc lỗi khác: giữ gợi ý cũ nếu có và nói rõ lý do.
      setError(messageOf(err, "Chưa tải được gợi ý."));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <MobileStateCard tone="loading" title="Đang tìm việc phù hợp với bạn…" />;
  if (error && !data) return <MobileStateCard tone="error" title="Chưa tải được gợi ý" description={error} onRetry={load} />;
  if (!data) return null;

  const { completeness } = data;
  const percent = completeness.total ? Math.round((completeness.filled / completeness.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {error && <MobileStateCard tone="error" title="Chưa làm mới được gợi ý" description={`Gợi ý cũ vẫn còn. ${error}`} onRetry={load} />}

      <div className="rounded-xl border border-black/5 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-extrabold text-brand-navy">Hồ sơ dùng để gợi ý</h2>
          <span className="text-[14px] font-extrabold text-brand-orange">
            {completeness.filled}/{completeness.total}
          </span>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-black/5">
          <div className="h-full rounded-full bg-brand-orange" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2.5 text-[12.5px] leading-relaxed text-brand-navy/60">
          {completeness.missing.length > 0
            ? `Thêm ${completeness.missing.map((item) => MISSING_FIELD_LABELS[item] ?? item).join(", ")} để gợi ý chính xác hơn. Mục chưa điền sẽ không bị tính là không phù hợp.`
            : "Hồ sơ đã đủ thông tin để gợi ý."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={ROUTES.congNhanAccount} className={`rounded-lg border px-3.5 py-1.5 text-[12.5px] font-bold ${accent.border} ${accent.text}`}>
            Cập nhật hồ sơ
          </Link>
          <button type="button" onClick={onOpenPreferences} className={`rounded-lg border px-3.5 py-1.5 text-[12.5px] font-bold ${accent.border} ${accent.text}`}>
            Tùy chọn gợi ý
          </button>
          <button type="button" onClick={load} disabled={loading} className="rounded-lg border border-black/10 px-3.5 py-1.5 text-[12.5px] font-bold text-brand-navy/60 disabled:opacity-50">
            {loading ? "Đang tải…" : "Làm mới"}
          </button>
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-brand-navy/45">
          Họ tên, số điện thoại, Zalo và lịch sử ứng tuyển không được dùng để gợi ý và không gửi cho bên thứ ba.
          {data.semantic ? " Có dùng AI để so khớp nội dung mô tả công việc." : ""}
        </p>
      </div>

      {data.servicesIncomplete && (
        <MobileStateCard tone="error" title="Một số dịch vụ chưa tải được" description="Danh sách việc làm vẫn dùng được. Hãy thử làm mới để kiểm tra các dịch vụ liên quan." onRetry={load} />
      )}

      <div>
        <h2 className="mb-2 text-[15px] font-extrabold text-brand-navy">{data.personalized ? "Việc làm phù hợp" : "Việc làm mới nhất"}</h2>
        {!data.personalized && (
          <p className="mb-2 text-[12.5px] text-brand-navy/55">
            Chưa có thông tin trong hồ sơ để cá nhân hóa, nên đang hiện việc mới nhất. Cập nhật hồ sơ để nhận gợi ý riêng.
          </p>
        )}
        {data.jobs.length === 0 ? (
          <MobileStateCard tone="empty" title="Chưa có việc đủ phù hợp" description="Thử nới điều kiện trong hồ sơ hoặc Tùy chọn gợi ý." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.jobs.map(({ job, score, reasons }) => {
              const band = matchBand(score);
              const labels = reasonLabels(reasons, JOB_REASON_LABELS);
              return (
                <div key={job.id}>
                  <JobCard job={job} />
                  {(band || labels.length > 0) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1">
                      {band && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${BAND_CLASS[band.tone]}`}>{band.label}</span>}
                      {labels.map((label) => (
                        <span key={label} className="text-[11.5px] text-brand-navy/55">
                          ✓ {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {data.services.length > 0 && (
        <div>
          <h2 className="mb-2 text-[15px] font-extrabold text-brand-navy">Dịch vụ liên quan</h2>
          <div className="flex flex-col gap-2.5">
            {data.services.map((service) => (
              <Link
                key={`${service.type}-${service.id ?? "entry"}`}
                href={service.href}
                className="flex items-center gap-3 rounded-xl border border-black/5 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="text-[24px]" aria-hidden="true">
                  {SERVICE_ICON[service.type] ?? "📌"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-extrabold text-brand-navy">{service.title}</span>
                  {service.subtitle && <span className="block text-[12.5px] text-brand-navy/55">{service.subtitle}</span>}
                  {reasonLabels(service.reasons, SERVICE_REASON_LABELS).map((label) => (
                    <span key={label} className="block text-[11.5px] text-brand-navy/50">
                      ✓ {label}
                    </span>
                  ))}
                </span>
                <span className="text-brand-navy/30" aria-hidden="true">
                  ›
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-[11.5px] leading-relaxed text-brand-navy/45">
        Gợi ý chỉ mang tính tham khảo, không phải cam kết về việc làm hay dịch vụ. Hãy kiểm tra chi tiết trước khi ứng tuyển hoặc gửi
        yêu cầu.
      </p>
    </div>
  );
}

function Preferences({ onSaved }: { onSaved: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState<MatchPreferences | null>(null);
  const [kcn, setKcn] = useState<{ value: string; label: string }[]>([]);
  const [kcnLoading, setKcnLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  /** Lưu chưa rõ kết quả: khoá nút cho tới khi tải lại tùy chọn, như app. */
  const [needsReview, setNeedsReview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setValues(await getPreferences());
      setNeedsReview(false);
      setError("");
    } catch (err) {
      if (isSessionExpired(err)) {
        router.replace(ROUTES.congNhanLogin);
        return;
      }
      setLoadError(messageOf(err, "Chưa tải được tùy chọn gợi ý."));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const province = values?.workProvinceCode ?? "";
  useEffect(() => {
    if (!province) {
      setKcn([]);
      return;
    }
    let alive = true;
    setKcnLoading(true);
    listKcn(province)
      .then((list) => alive && setKcn(list.map((item) => ({ value: item.id, label: item.name }))))
      .catch(() => alive && setKcn([]))
      .finally(() => alive && setKcnLoading(false));
    return () => {
      alive = false;
    };
  }, [province]);

  if (loading && !values) return <MobileStateCard tone="loading" title="Đang tải tùy chọn…" />;
  if (!values) {
    return (
      <MobileStateCard
        tone="error"
        title="Chưa tải được tùy chọn"
        description={loadError || "Hãy tải lại trước khi chỉnh sửa để tránh ghi đè dữ liệu đã lưu."}
        onRetry={load}
      />
    );
  }

  const toggle = (value: MatchService) =>
    setValues((current) =>
      current
        ? {
            ...current,
            interestedServices: current.interestedServices.includes(value)
              ? current.interestedServices.filter((item) => item !== value)
              : [...current.interestedServices, value],
          }
        : current,
    );

  async function save() {
    if (!values || saving || needsReview) return;
    setSaving(true);
    setError("");
    try {
      await updatePreferences(values);
      onSaved();
    } catch (err) {
      if (isSessionExpired(err)) {
        router.replace(ROUTES.congNhanLogin);
        return;
      }
      setError(messageOf(err, "Chưa lưu được tùy chọn."));
      if (err instanceof MobileApiError && err.uncertain) setNeedsReview(true);
    } finally {
      setSaving(false);
    }
  }

  const off = saving || needsReview;

  return (
    <div className="rounded-xl border border-black/5 bg-white p-5">
      <p className="mb-4 text-[12.5px] leading-relaxed text-brand-navy/55">
        Cho biết nơi bạn muốn làm và dịch vụ bạn quan tâm. Ngành nghề, lương, kinh nghiệm, ca làm và nhà ở lấy từ Hồ sơ của bạn.
        Đây không phải đồng ý chia sẻ hồ sơ cho đối tác.
      </p>
      <div className="flex flex-col gap-3.5">
        <div>
          <SelectField
            label="Tỉnh/thành muốn làm việc"
            name="workProvince"
            value={values.workProvinceCode}
            onChange={(value) => setValues({ ...values, workProvinceCode: value, kcnId: "" })}
            options={PROVINCE_OPTIONS}
            placeholder="Chưa chọn"
            disabled={off}
            accent={accent}
          />
          <p className="mt-1 text-[12px] text-brand-navy/45">Tỉnh trong hồ sơ có thể chỉ là nơi ở, nên nơi muốn làm được chọn riêng.</p>
        </div>
        <div>
          <SelectField
            label="Khu công nghiệp (không bắt buộc)"
            name="kcn"
            value={values.kcnId}
            onChange={(value) => setValues({ ...values, kcnId: value })}
            options={kcn}
            placeholder="Chưa chọn"
            disabled={off || !province}
            accent={accent}
          />
          <p className="mt-1 text-[12px] text-brand-navy/45">
            {!province
              ? "Chọn tỉnh/thành để xem danh sách KCN."
              : kcnLoading
                ? "Đang tải danh sách KCN…"
                : kcn.length
                  ? "Chọn KCN để ưu tiên việc và phòng trọ gần đó."
                  : "Chưa có KCN cho tỉnh này."}
          </p>
        </div>

        <fieldset>
          <legend className="text-[12px] font-semibold text-brand-navy/60">Dịch vụ quan tâm</legend>
          <div className="mt-2 flex flex-col gap-2">
            {SERVICE_OPTIONS.map((option) => {
              const on = values.interestedServices.includes(option.value);
              return (
                <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-black/5 p-3 hover:bg-black/[0.02]">
                  <input type="checkbox" checked={on} disabled={off} onChange={() => toggle(option.value)} className="mt-0.5 h-4 w-4 accent-[#e8541a]" />
                  <span>
                    <span className="block text-[13px] font-bold text-brand-navy">{option.label}</span>
                    <span className="block text-[12px] text-brand-navy/50">{option.note}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700" role="alert">
            {error}
            {needsReview && (
              <button type="button" onClick={load} className="ml-2 font-bold underline">
                Tải lại tùy chọn
              </button>
            )}
          </div>
        )}

        <button type="button" disabled={off} onClick={save} className={`rounded-xl py-2.5 text-[13.5px] font-extrabold transition disabled:opacity-50 ${accent.button}`}>
          {saving ? "Đang lưu…" : "Lưu tùy chọn"}
        </button>
      </div>
    </div>
  );
}
