"use client";

import { PORTAL_ACCENT } from "@/lib/portal-accent";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
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
import {
  getProfile,
  listInquiries,
  openInquiryContact,
  updateInquiryStatus,
  type ContactResult,
  type InquiryRow,
} from "@/lib/health-provider-client";
import {
  HEALTH_CATEGORY_OPTIONS,
  INQUIRY_FILTERS,
  INQUIRY_STATUS_LABEL,
  INQUIRY_STATUS_TONE,
  INQUIRY_TRANSITIONS,
} from "@/lib/health-provider-portal";
import { ROUTES } from "@/lib/routes";
import { formatCalendarDate } from "@/lib/worker-services";

const accent = PORTAL_ACCENT;

const text = (value: unknown) => (typeof value === "string" ? value : "");

export function HealthInquiries() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  /** Liên hệ đã mở trong phiên xem này; không lưu lâu dài, tải lại trang là ẩn đi. */
  const [contacts, setContacts] = useState<Record<string, ContactResult>>({});
  const [limit, setLimit] = useState<number | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);

  const expired = useCallback(() => router.replace(ROUTES.yTeDoiTacLogin), [router]);
  const list = useMobileList<InquiryRow>((params) => listInquiries(params), { status, q: query }, { onSessionExpired: expired });
  const action = useMobileAction(list.reload, expired);

  // Danh sách yêu cầu không trả hạn mức, nên đọc từ hồ sơ (cũng cho biết cơ sở đã xác minh chưa).
  useEffect(() => {
    getProfile()
      .then((profile) => {
        setLimit(typeof profile.contact_view_limit === "number" ? profile.contact_view_limit : 0);
        setVerified(profile.is_verified);
      })
      .catch((err) => {
        if (isSessionExpired(err)) expired();
      });
  }, [expired]);

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
        setLimit(result.viewLimit);
      });
    },
    [action],
  );

  const changeStatus = useCallback(
    (row: InquiryRow, next: string) => {
      if (next === "cancelled" && !window.confirm("Hủy yêu cầu này? Bạn không thể đổi lại về “Mới”.")) return;
      action.run(row.id, () => updateInquiryStatus(row.id, next));
    },
    [action],
  );

  return (
    <>
      <PortalHeading
        title="📨 Yêu cầu liên hệ"
        description={`Số điện thoại được ẩn trong danh sách. Hạn mức hiện tại: ${limit ?? "—"} lượt/tháng.`}
      />

      {verified === false && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-800">
          Cơ sở chưa được Admin xác minh nên chưa mở được liên hệ. Bạn vẫn xem và đổi trạng thái yêu cầu được.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MobileSearch draft={draft} onDraftChange={setDraft} onSearch={() => setQuery(draft.trim())} placeholder="Tìm theo tên người gửi…" />
        <MobileFilterChips options={INQUIRY_FILTERS} active={status} onChange={setStatus} />
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
            const service = row.service as { title?: unknown; category?: unknown } | null;
            const category = HEALTH_CATEGORY_OPTIONS.find((option) => option.value === service?.category)?.label;
            const date = formatCalendarDate(row.desired_date);
            const time = text(row.preferred_time);

            return (
              <article key={row.id} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-extrabold text-brand-navy">{row.full_name}</h3>
                      <StatusPill
                        label={INQUIRY_STATUS_LABEL[row.status] ?? row.status}
                        tone={INQUIRY_STATUS_TONE[row.status] ?? "gray"}
                      />
                    </div>
                    <p className="mt-1 text-[12.5px] font-semibold text-brand-orange">
                      {text(service?.title) || "Dịch vụ y tế"}
                      {category ? <span className="font-normal text-brand-navy/45"> · {category}</span> : null}
                    </p>
                    <p className="mt-1 text-[12.5px] text-brand-navy/60">
                      Ngày mong muốn: {date ?? "Chưa chọn"}
                      {time ? ` · khung giờ: ${time}` : ""}
                    </p>
                    <p className="mt-1 text-[11.5px] text-brand-navy/40">Gửi {formatDateTime(text(row.created_at))}</p>

                    {contact && (
                      <div className="mt-2.5 rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-800">
                        <span className="font-bold">{contact.fullName || row.full_name}</span>
                        {" · "}
                        <a href={`tel:${contact.phone}`} className="font-extrabold underline">
                          {contact.phone}
                        </a>
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
                        disabled={disabled || verified === false}
                        title={verified === false ? "Cơ sở cần được Admin xác minh mới mở được liên hệ" : undefined}
                        onClick={() => openContact(row)}
                        className={`rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition disabled:opacity-40 ${accent.button}`}
                      >
                        {busy ? "Đang xử lý…" : "Mở liên hệ"}
                      </button>
                    )}
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {INQUIRY_TRANSITIONS.filter((value) => value !== row.status).map((value) => (
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
                          {INQUIRY_STATUS_LABEL[value]}
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
