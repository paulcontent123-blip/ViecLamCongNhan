"use client";

// Kho học viên: hồ sơ công nhân đã đồng ý chia sẻ, hiện ẩn danh. Số điện thoại chỉ mở từng người và mỗi
// lượt mở trừ vào hạn mức tháng của gói (Free 0, Basic 60, Premium 300).

import { PORTAL_ACCENT } from "@/lib/portal-accent";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { SelectField } from "@/components/dichvucongnhan/ui";
import {
  MobileActionAlert,
  MobilePager,
  MobileSearch,
  MobileStateCard,
} from "@/components/shared/mobileUi";
import { PortalHeading } from "@/components/doitac/PortalChrome";
import { useMobileAction, useMobileList } from "@/components/shared/useMobileList";
import { JOB_INDUSTRIES } from "@/lib/industries";
import { PROVINCES, provinceName } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";
import { listLearners, openLearnerContact, type ContactResult, type LearnerRow } from "@/lib/training-provider-client";
import { quotaNote, remainingViews, type QuotaUsage } from "@/lib/training-provider-portal";
import { displayProvince } from "@/lib/worker-services";

const accent = PORTAL_ACCENT;
const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));
// Lọc theo ngành gửi lên là chữ người dùng chọn; dùng nhãn để khớp dữ liệu công nhân tự khai.
const INDUSTRY_OPTIONS = JOB_INDUSTRIES.map((industry) => ({ value: industry.label, label: industry.label }));

const text = (value: unknown) => (typeof value === "string" ? value : "");

function usageFrom(extra: Record<string, unknown>): QuotaUsage | null {
  const usage = extra.usage as Record<string, unknown> | undefined;
  if (!usage || typeof usage.tier !== "string" || typeof usage.verified !== "boolean") return null;
  return {
    tier: usage.tier,
    verified: usage.verified,
    viewLimit: Number.isSafeInteger(usage.viewLimit) ? (usage.viewLimit as number) : 0,
    viewedCount: Number.isSafeInteger(usage.viewedCount) ? (usage.viewedCount as number) : 0,
  };
}

function salary(value: unknown): string | null {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) return null;
  return `từ ${(value as number).toLocaleString("vi-VN")}đ/tháng`;
}

export function TrainingLearners() {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [province, setProvince] = useState("");
  const [industry, setIndustry] = useState("");
  const [contacts, setContacts] = useState<Record<string, ContactResult>>({});

  const expired = useCallback(() => router.replace(ROUTES.hocNgheDoiTacLogin), [router]);
  const list = useMobileList<LearnerRow>(
    (params) => listLearners(params),
    { q: query, province, industry },
    { onSessionExpired: expired },
  );
  const action = useMobileAction(list.reload, expired);

  const usage = usageFrom(list.extra);
  const remaining = remainingViews(usage);

  /** Mở liên hệ là thao tác ghi (trừ hạn mức): dùng chung cơ chế khoá khi kết quả chưa rõ. */
  const openContact = useCallback(
    (row: LearnerRow) =>
      action.run(row.id, async () => {
        const result = await openLearnerContact(row.id);
        setContacts((current) => ({ ...current, [row.id]: result }));
      }),
    [action],
  );

  return (
    <>
      <PortalHeading
        title="🔎 Kho học viên"
        description="Hồ sơ công nhân đã đồng ý chia sẻ thông tin. Danh sách hiện ẩn danh; mở liên hệ từng người theo hạn mức."
      />

      <div className={`mb-4 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed ${accent.tint}`}>
        {quotaNote(usage)}
        {usage && usage.verified && usage.viewLimit > 0 ? ` Còn ${remaining} lượt.` : ""}
      </div>

      <div className="mb-4 rounded-xl border border-black/5 bg-white p-4">
        <MobileSearch
          draft={draft}
          onDraftChange={setDraft}
          onSearch={() => setQuery(draft.trim())}
          placeholder="Tìm theo tên hoặc nguyện vọng…"
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Tỉnh/thành"
            name="province"
            value={province}
            onChange={setProvince}
            options={PROVINCE_OPTIONS}
            placeholder="Tất cả tỉnh/thành"
            accent={accent}
          />
          <SelectField
            label="Ngành nghề mong muốn"
            name="industry"
            value={industry}
            onChange={setIndustry}
            options={INDUSTRY_OPTIONS}
            placeholder="Tất cả ngành nghề"
            accent={accent}
          />
        </div>
      </div>

      <MobileActionAlert action={action} onReload={list.reload} />

      {list.error && (
        <div className="mb-3">
          <MobileStateCard
            tone="error"
            title="Chưa tải được Kho học viên"
            description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
            onRetry={list.reload}
          />
        </div>
      )}

      {list.loading && !list.items.length && !list.error && <MobileStateCard tone="loading" title="Đang tải hồ sơ…" />}

      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <MobileStateCard
          tone="empty"
          title="Chưa có hồ sơ phù hợp"
          description="Thử bỏ bộ lọc tỉnh/thành hoặc ngành nghề. Kho chỉ gồm công nhân đã đồng ý chia sẻ thông tin."
        />
      )}

      {list.items.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.items.map((row) => {
            const busy = action.busyId === row.id;
            const contact = contacts[row.id];
            const place = displayProvince(text(row.province), provinceName);
            const years = Number.isSafeInteger(row.experience_years) ? (row.experience_years as number) : null;
            const meta = [
              text(row.desired_industry) || "Chưa cung cấp ngành",
              place,
              years === null ? null : `${years} năm kinh nghiệm`,
              salary(row.desired_salary_min),
            ].filter(Boolean);

            return (
              <article key={row.id} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                <h3 className="text-[14px] font-extrabold text-brand-navy">{row.full_name}</h3>
                <p className="mt-1 text-[12.5px] text-brand-navy/55">{meta.join(" · ")}</p>

                {contact ? (
                  <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">
                    <a href={`tel:${contact.phone}`} className="font-extrabold underline">
                      {contact.phone}
                    </a>
                    {contact.email ? (
                      <>
                        {" · "}
                        <a href={`mailto:${contact.email}`} className="font-semibold underline">
                          {contact.email}
                        </a>
                      </>
                    ) : null}
                    <div className="mt-0.5 text-[11.5px] text-emerald-700/80">
                      Đã dùng {contact.viewedCount}/{contact.viewLimit} lượt trong tháng
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busy || action.needsReload || (usage !== null && (!usage.verified || remaining <= 0))}
                    title={
                      usage && usage.verified && remaining <= 0
                        ? "Đã dùng hết hạn mức mở liên hệ trong tháng"
                        : undefined
                    }
                    onClick={() => openContact(row)}
                    className={`mt-3 rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition disabled:opacity-40 ${accent.button}`}
                  >
                    {busy ? "Đang mở…" : "Mở liên hệ"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      <MobilePager list={list} unit="hồ sơ" />
    </>
  );
}
