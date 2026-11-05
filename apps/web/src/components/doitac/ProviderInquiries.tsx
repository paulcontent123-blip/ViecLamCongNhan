"use client";

// Màn "Yêu cầu" dùng chung cho Bảo hiểm, Tài chính và Thuê trọ: danh sách người gửi, đổi trạng thái, và mở liên hệ
// theo hạn mức tháng. Ba cổng khác nhau ở tập trạng thái, thông tin hiện trên thẻ và nơi lấy hạn mức, nên truyền
// qua props; luồng xử lý và quy tắc "chưa xác định thì khoá" dùng chung.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import type { ProviderAccent } from "@/components/doitac/FieldGrid";
import { PortalHeading } from "@/components/doitac/PortalChrome";
import {
  MobileActionAlert,
  MobileFilterChips,
  MobilePager,
  MobileSearch,
  MobileStateCard,
} from "@/components/shared/mobileUi";
import { isSessionExpired, useMobileAction, useMobileList } from "@/components/shared/useMobileList";
import { formatDateTime } from "@/lib/format-date";
import type { StatusTone } from "@/lib/provider-portal-common";
import type { MobileListResult, MobileQuery } from "@/lib/mobile-session-client";

type InquiryRow = Record<string, unknown> & { id: string; full_name: string; status: string };
type Contact = { phone: string; email: string | null; zalo: string | null; viewedCount: number; viewLimit: number };

const text = (value: unknown) => (typeof value === "string" ? value : "");

export function ProviderInquiries({
  loginHref,
  accent,
  title,
  description,
  searchPlaceholder,
  labels,
  tones,
  filters,
  transitions,
  listInquiries,
  updateInquiryStatus,
  openInquiryContact,
  getVerified,
  subject,
  details,
  hasMessage = true,
}: {
  loginHref: string;
  accent: ProviderAccent;
  title: string;
  description: string;
  searchPlaceholder: string;
  labels: Record<string, string>;
  tones: Record<string, StatusTone>;
  filters: { value: string; label: string }[];
  /** Các trạng thái đối tác được đổi sang (không gồm "new"). */
  transitions: readonly string[];
  listInquiries: (params: MobileQuery) => Promise<MobileListResult<InquiryRow>>;
  updateInquiryStatus: (id: string, status: string) => Promise<void>;
  openInquiryContact: (id: string) => Promise<Contact>;
  /** Cơ sở đã xác minh chưa; chưa thì khoá nút mở liên hệ. Bỏ qua nếu route danh sách đã trả `usage.verified`. */
  getVerified?: () => Promise<boolean>;
  /** Dòng đề mục dưới tên người gửi (tên sản phẩm, tên tin cho thuê…). */
  subject: (row: InquiryRow) => string;
  /** Các dòng thông tin thêm trên thẻ. */
  details?: (row: InquiryRow) => string[];
  hasMessage?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  /** Liên hệ đã mở trong phiên xem này; không lưu lâu dài, tải lại trang là ẩn đi. */
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [verified, setVerified] = useState<boolean | null>(null);
  const [lastQuota, setLastQuota] = useState<{ viewedCount: number; viewLimit: number } | null>(null);

  const expired = useCallback(() => router.replace(loginHref), [router, loginHref]);
  const list = useMobileList<InquiryRow>((params) => listInquiries(params), { status, q: query }, { onSessionExpired: expired });
  const action = useMobileAction(list.reload, expired);

  useEffect(() => {
    if (!getVerified) return;
    getVerified()
      .then(setVerified)
      .catch((err) => {
        if (isSessionExpired(err)) expired();
      });
    // `getVerified` do nơi gọi tạo; chỉ hỏi một lần khi mở màn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usage = list.extra.usage as { verified?: unknown; viewedCount?: unknown; viewLimit?: unknown } | undefined;
  const isVerified = typeof usage?.verified === "boolean" ? usage.verified : verified;
  const quota = lastQuota
    ? lastQuota
    : usage && Number.isSafeInteger(usage.viewedCount) && Number.isSafeInteger(usage.viewLimit)
      ? { viewedCount: usage.viewedCount as number, viewLimit: usage.viewLimit as number }
      : null;

  const openContact = useCallback(
    (row: InquiryRow) => {
      // Mở liên hệ trừ vào hạn mức tháng, nên hỏi lại như app.
      const ok = window.confirm(
        "Mở số điện thoại này? Lượt mở liên hệ sẽ được tính vào hạn mức tháng. Mở lại hồ sơ trong tháng không tính thêm.",
      );
      if (!ok) return;
      action.run(row.id, async () => {
        const result = await openInquiryContact(row.id);
        setContacts((current) => ({ ...current, [row.id]: result }));
        setLastQuota({ viewedCount: result.viewedCount, viewLimit: result.viewLimit });
      });
    },
    [action, openInquiryContact],
  );

  const changeStatus = useCallback(
    (row: InquiryRow, next: string) => {
      if (next === "cancelled" && !window.confirm("Hủy yêu cầu này? Bạn không thể đổi lại về “Mới”.")) return;
      action.run(row.id, () => updateInquiryStatus(row.id, next));
    },
    [action, updateInquiryStatus],
  );

  return (
    <>
      <PortalHeading title={title} description={description} />

      <div className={`mb-4 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed ${accent.tint}`}>
        {quota
          ? `Đã dùng ${quota.viewedCount}/${quota.viewLimit} lượt mở liên hệ trong tháng. Mở lại cùng người trong tháng không trừ thêm lượt.`
          : "Mở liên hệ tiêu hao 1 lượt trong hạn mức tháng của gói. Mở lại cùng người trong tháng không trừ thêm lượt."}
      </div>

      {isVerified === false && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-800">
          Chưa được Admin xác minh nên chưa mở được liên hệ. Bạn vẫn xem và đổi trạng thái yêu cầu được.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MobileSearch draft={draft} onDraftChange={setDraft} onSearch={() => setQuery(draft.trim())} placeholder={searchPlaceholder} />
        <MobileFilterChips options={filters} active={status} onChange={setStatus} />
      </div>

      <MobileActionAlert action={action} onReload={list.reload} />

      {list.error && (
        <div className="mb-3">
          <MobileStateCard
            tone="error"
            title="Chưa tải được yêu cầu"
            description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
            onRetry={list.reload}
          />
        </div>
      )}

      {list.loading && !list.items.length && !list.error && <MobileStateCard tone="loading" title="Đang tải yêu cầu…" />}

      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <MobileStateCard tone="empty" title="Chưa có yêu cầu nào ở trạng thái này" />
      )}

      {list.items.length > 0 && (
        <div className="flex flex-col gap-3">
          {list.items.map((row) => {
            const busy = action.busyId === row.id;
            const disabled = busy || action.needsReload;
            const contact = contacts[row.id];
            const extra = details?.(row) ?? [];
            return (
              <article key={row.id} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-extrabold text-brand-navy">{row.full_name}</h3>
                      <StatusPill label={labels[row.status] ?? row.status} tone={tones[row.status] ?? "gray"} />
                    </div>
                    {subject(row) && <p className={`mt-1 text-[12.5px] font-semibold ${accent.text}`}>{subject(row)}</p>}
                    {extra.map((line) => (
                      <p key={line} className="mt-1 text-[12.5px] text-brand-navy/55">
                        {line}
                      </p>
                    ))}
                    {hasMessage && text(row.message) && (
                      <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed text-brand-navy/60">{text(row.message)}</p>
                    )}
                    <p className="mt-1.5 text-[11.5px] text-brand-navy/40">Gửi {formatDateTime(text(row.created_at))}</p>

                    {contact && (
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
                        <div className="mt-0.5 text-[11.5px] text-emerald-700/80">
                          Đã dùng {contact.viewedCount}/{contact.viewLimit} lượt tháng này
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {!contact && (
                      <button
                        type="button"
                        disabled={disabled || isVerified === false}
                        title={isVerified === false ? "Cần được Admin xác minh mới mở được liên hệ" : undefined}
                        onClick={() => openContact(row)}
                        className={`rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition disabled:opacity-40 ${accent.button}`}
                      >
                        {busy ? "Đang xử lý…" : "Mở liên hệ"}
                      </button>
                    )}
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {transitions
                        .filter((value) => value !== row.status)
                        .map((value) => (
                          <button
                            key={value}
                            type="button"
                            disabled={disabled}
                            onClick={() => changeStatus(row, value)}
                            className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold transition disabled:opacity-40 ${
                              value === "cancelled"
                                ? "border-black/10 text-brand-navy/55 hover:border-red-300 hover:text-red-600"
                                : `${accent.border} ${accent.text}`
                            }`}
                          >
                            {labels[value] ?? value}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <MobilePager list={list} unit="yêu cầu" />
    </>
  );
}
