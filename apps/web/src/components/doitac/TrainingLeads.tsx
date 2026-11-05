"use client";

// Màn "Yêu cầu học nghề" và "Hồ sơ học viên" dùng chung component này: cùng là danh sách người quan tâm,
// cùng cách đổi trạng thái và cùng cách mở liên hệ theo hạn mức tháng. Khác nhau ở tập trạng thái và ở
// chỗ hồ sơ học viên được máy chủ trả sẵn hạn mức trong danh sách, còn yêu cầu thì chỉ biết sau khi mở.

import { PORTAL_ACCENT } from "@/lib/portal-accent";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MobileActionAlert,
  MobileFilterChips,
  MobilePager,
  MobileSearch,
  MobileStateCard,
} from "@/components/shared/mobileUi";
import { PortalHeading } from "@/components/doitac/PortalChrome";
import { StatusPill } from "@/components/admin/StatusPill";
import { useMobileAction, useMobileList } from "@/components/shared/useMobileList";
import { formatDateTime } from "@/lib/format-date";
import { ROUTES } from "@/lib/routes";
import {
  listApplications,
  listInquiries,
  openApplicationContact,
  openInquiryContact,
  updateApplicationStatus,
  updateInquiryStatus,
  type ContactResult,
} from "@/lib/training-provider-client";
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_TONE,
  APPLICATION_STATUSES,
  INQUIRY_ACTIONS,
  INQUIRY_STATUS_LABEL,
  INQUIRY_STATUS_TONE,
  INQUIRY_STATUSES,
  quotaNote,
  type QuotaUsage,
  type StatusTone,
} from "@/lib/training-provider-portal";

const accent = PORTAL_ACCENT;

export type LeadKind = "inquiries" | "applications";

type LeadRow = Record<string, unknown> & { id: string; full_name: string; status: string };

const CONFIG: Record<
  LeadKind,
  {
    title: string;
    description: string;
    unit: string;
    statuses: readonly string[];
    label: Record<string, string>;
    tone: Record<string, StatusTone>;
    /** Yêu cầu dùng nút nhanh theo luồng tư vấn; hồ sơ dùng danh sách chọn đủ 5 trạng thái. */
    control: "buttons" | "select";
    list: (params: Record<string, unknown>) => ReturnType<typeof listInquiries>;
    updateStatus: (id: string, status: string) => Promise<void>;
    openContact: (id: string) => Promise<ContactResult>;
  }
> = {
  inquiries: {
    title: "📨 Yêu cầu học nghề",
    description: "Yêu cầu tư vấn công nhân gửi cho khóa học của đơn vị. Mở liên hệ sẽ tiêu hao hạn mức tháng.",
    unit: "yêu cầu",
    statuses: INQUIRY_STATUSES,
    label: INQUIRY_STATUS_LABEL,
    tone: INQUIRY_STATUS_TONE,
    control: "buttons",
    list: listInquiries,
    updateStatus: updateInquiryStatus,
    openContact: openInquiryContact,
  },
  applications: {
    title: "📄 Hồ sơ học viên",
    description: "Hồ sơ công nhân nộp vào khóa học. Mở liên hệ sẽ tiêu hao hạn mức tháng theo gói của đơn vị.",
    unit: "hồ sơ",
    statuses: APPLICATION_STATUSES,
    label: APPLICATION_STATUS_LABEL,
    tone: APPLICATION_STATUS_TONE,
    control: "select",
    list: listApplications,
    updateStatus: updateApplicationStatus,
    openContact: openApplicationContact,
  },
};

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

export function TrainingLeads({ kind }: { kind: LeadKind }) {
  const config = CONFIG[kind];
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  /** Liên hệ đã mở trong phiên xem này; không lưu lâu dài, tải lại trang là ẩn đi. */
  const [contacts, setContacts] = useState<Record<string, ContactResult>>({});
  const [lastQuota, setLastQuota] = useState<{ viewedCount: number; viewLimit: number } | null>(null);

  const expired = useCallback(() => router.replace(ROUTES.hocNgheDoiTacLogin), [router]);
  const list = useMobileList<LeadRow>((params) => config.list(params), { status, q: query }, { onSessionExpired: expired });
  const action = useMobileAction(list.reload, expired);

  const usage = usageFrom(list.extra);
  const quota = usage
    ? quotaNote(usage)
    : lastQuota
      ? `Đã dùng ${lastQuota.viewedCount}/${lastQuota.viewLimit} lượt mở liên hệ trong tháng. Mở lại cùng người trong tháng không trừ thêm lượt.`
      : "Mở liên hệ tiêu hao 1 lượt trong hạn mức tháng. Mở lại cùng người trong tháng không trừ thêm lượt.";

  const statusOptions = [
    { value: "", label: "Tất cả" },
    ...config.statuses.map((value) => ({ value, label: config.label[value] ?? value })),
  ];

  /** Mở liên hệ là thao tác GHI (trừ hạn mức), nên đi qua cùng cơ chế khoá khi kết quả chưa rõ. */
  const openContact = useCallback(
    (row: LeadRow) =>
      action.run(row.id, async () => {
        const result = await config.openContact(row.id);
        setContacts((current) => ({ ...current, [row.id]: result }));
        setLastQuota({ viewedCount: result.viewedCount, viewLimit: result.viewLimit });
      }),
    [action, config],
  );

  return (
    <>
      <PortalHeading title={config.title} description={config.description} />

      <div className={`mb-4 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed ${accent.tint}`}>{quota}</div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MobileSearch draft={draft} onDraftChange={setDraft} onSearch={() => setQuery(draft.trim())} placeholder="Tìm theo tên người gửi…" />
        <MobileFilterChips options={statusOptions} active={status} onChange={setStatus} />
      </div>

      <MobileActionAlert action={action} onReload={list.reload} />

      {list.error && (
        <div className="mb-3">
          <MobileStateCard
            tone="error"
            title={`Chưa tải được ${config.unit}`}
            description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
            onRetry={list.reload}
          />
        </div>
      )}

      {list.loading && !list.items.length && !list.error && <MobileStateCard tone="loading" title="Đang tải danh sách…" />}

      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <MobileStateCard tone="empty" title={`Chưa có ${config.unit} nào ở trạng thái này`} />
      )}

      {list.items.length > 0 && (
        <div className="flex flex-col gap-3">
          {list.items.map((row) => {
            const busy = action.busyId === row.id;
            const disabled = busy || action.needsReload;
            const contact = contacts[row.id];
            const courseTitle = text((row.vocational_courses as { title?: unknown } | null)?.title);
            return (
              <article key={row.id} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-extrabold text-brand-navy">{row.full_name}</h3>
                      <StatusPill label={config.label[row.status] ?? row.status} tone={config.tone[row.status] ?? "gray"} />
                    </div>
                    {courseTitle && <p className="mt-1 text-[12.5px] text-brand-navy/55">Khóa học: {courseTitle}</p>}
                    {text(row.message) && (
                      <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed text-brand-navy/60">
                        {text(row.message)}
                      </p>
                    )}
                    <p className="mt-1.5 text-[11.5px] text-brand-navy/40">
                      Gửi {formatDateTime(text(row.created_at))}
                    </p>

                    {contact ? (
                      <div className="mt-2.5 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">
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
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {!contact && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => openContact(row)}
                        className={`rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition disabled:opacity-40 ${accent.button}`}
                      >
                        {busy ? "Đang mở…" : "Mở liên hệ"}
                      </button>
                    )}

                    {config.control === "select" ? (
                      <label className="text-[11.5px] font-semibold text-brand-navy/50">
                        Trạng thái
                        <select
                          value={row.status}
                          disabled={disabled}
                          onChange={(event) =>
                            action.run(row.id, () => config.updateStatus(row.id, event.target.value))
                          }
                          className="ml-2 rounded-lg border border-black/10 px-2 py-1.5 text-[12px] font-bold text-brand-navy outline-none focus:border-brand-orange disabled:opacity-40"
                        >
                          {config.statuses.map((value) => (
                            <option key={value} value={value}>
                              {config.label[value]}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {INQUIRY_ACTIONS.filter((value) => value !== row.status).map((value) => (
                          <button
                            key={value}
                            type="button"
                            disabled={disabled}
                            onClick={() => action.run(row.id, () => config.updateStatus(row.id, value))}
                            className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold transition disabled:opacity-40 ${accent.border} ${accent.text}`}
                          >
                            {config.label[value]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <MobilePager list={list} unit={config.unit} />
    </>
  );
}
