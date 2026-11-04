"use client";

import { useCallback, useState } from "react";
import {
  AdminActionAlert,
  AdminFilterChips,
  AdminPager,
  AdminStateCard,
  useAdminAction,
  useAdminMobileList,
} from "@/components/admin/AdminMobileShared";
import { StatusPill } from "@/components/admin/StatusPill";
import { BUG_REPORT_STATUSES, type BugReportStatus } from "@/lib/bug-reports";
import { formatDateTime } from "@/lib/format-date";
import { adminPatch } from "@/lib/mobile-admin-client";

const STATUS_LABEL: Record<string, string> = {
  new: "Mới",
  in_progress: "Đang xử lý",
  resolved: "Đã xử lý",
  closed: "Đã đóng",
};

const STATUS_TONE: Record<string, "amber" | "blue" | "green" | "gray"> = {
  new: "amber",
  in_progress: "blue",
  resolved: "green",
  closed: "gray",
};

/** Vai trò người gửi; khớp BUG_REPORT_ROLES ở `lib/bug-reports.ts`. */
const ROLE_LABEL: Record<string, string> = {
  candidate: "Công nhân",
  employer: "Nhà tuyển dụng",
  training_provider: "Đơn vị đào tạo",
  rental_provider: "Chủ trọ",
  insurance_provider: "Đơn vị bảo hiểm",
  finance_provider: "Đơn vị tài chính",
  health_provider: "Cơ sở y tế",
};

type BugReportRow = {
  id: string;
  reporter_role: string;
  reporter_name: string | null;
  title: string;
  description: string;
  app_version: string | null;
  platform: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  handled_at: string | null;
};

function ReportCard({
  item,
  action,
  onStatus,
  onNote,
}: {
  item: BugReportRow;
  action: ReturnType<typeof useAdminAction>;
  onStatus: (item: BugReportRow, status: BugReportStatus) => void;
  onNote: (item: BugReportRow, note: string) => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(item.admin_note ?? "");
  const busy = action.busyId === item.id;
  const disabled = busy || action.needsReload;

  return (
    <article className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-extrabold text-brand-navy">{item.title}</h3>
            <StatusPill label={STATUS_LABEL[item.status] ?? item.status} tone={STATUS_TONE[item.status] ?? "gray"} />
          </div>
          <p className="mt-1 text-[12px] text-brand-navy/50">
            {ROLE_LABEL[item.reporter_role] ?? item.reporter_role}
            {item.reporter_name ? ` · ${item.reporter_name}` : ""}
            {item.platform ? ` · ${item.platform}` : ""}
            {item.app_version ? ` · bản ${item.app_version}` : ""}
          </p>
          <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-brand-navy/70">
            {item.description}
          </p>
          <p className="mt-2 text-[11.5px] text-brand-navy/40">
            Gửi {formatDateTime(item.created_at)}
            {item.handled_at ? ` · xử lý ${formatDateTime(item.handled_at)}` : ""}
          </p>
          {item.admin_note && !editingNote && (
            <p className="mt-2 rounded-lg bg-black/[0.03] px-3 py-2 text-[12px] text-brand-navy/60">
              Ghi chú: {item.admin_note}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <label className="text-[11.5px] font-semibold text-brand-navy/50">
            Trạng thái
            <select
              value={item.status}
              disabled={disabled}
              onChange={(event) => onStatus(item, event.target.value as BugReportStatus)}
              className="ml-2 rounded-lg border border-black/10 px-2 py-1.5 text-[12px] font-bold text-brand-navy outline-none focus:border-brand-orange disabled:opacity-40"
            >
              {BUG_REPORT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setNote(item.admin_note ?? "");
              setEditingNote((value) => !value);
            }}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-[11.5px] font-bold text-brand-navy/60 transition hover:border-brand-orange hover:text-brand-orange disabled:opacity-40"
          >
            {item.admin_note ? "Sửa ghi chú" : "Thêm ghi chú"}
          </button>
        </div>
      </div>

      {editingNote && (
        <div className="mt-3 rounded-lg bg-black/[0.03] p-3">
          <label className="block text-[12px] font-semibold text-brand-navy/60">
            Ghi chú nội bộ (đối tác và công nhân không đọc được)
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={1000}
              disabled={disabled}
              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[12.5px] text-brand-navy outline-none focus:border-brand-orange"
            />
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onNote(item, note);
                setEditingNote(false);
              }}
              className="rounded-lg bg-brand-navy px-3 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-40"
            >
              Lưu ghi chú
            </button>
            <button
              type="button"
              onClick={() => setEditingNote(false)}
              className="rounded-lg border border-black/10 px-3 py-1.5 text-[11.5px] font-bold text-brand-navy/50"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export function BugReportManagement() {
  const [status, setStatus] = useState("");

  const list = useAdminMobileList<BugReportRow>("admin/bug-reports", { status });
  const action = useAdminAction(list.reload);
  const newCount = typeof list.extra.newCount === "number" ? list.extra.newCount : null;

  const patch = useCallback(async (item: BugReportRow, body: Record<string, unknown>) => {
    await adminPatch(`admin/bug-reports/${encodeURIComponent(item.id)}`, body);
  }, []);

  const statusOptions = [
    { value: "", label: "Tất cả" },
    ...BUG_REPORT_STATUSES.map((value) => ({ value, label: STATUS_LABEL[value] })),
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminFilterChips options={statusOptions} active={status} onChange={setStatus} />
        {newCount !== null && newCount > 0 && (
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[12px] font-bold text-amber-700">
            {newCount.toLocaleString("vi-VN")} báo lỗi chưa xử lý
          </span>
        )}
      </div>

      <AdminActionAlert action={action} onReload={list.reload} />

      {list.error && (
        <div className="mb-3">
          <AdminStateCard
            tone="error"
            title="Chưa tải được báo lỗi"
            description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
            onRetry={list.reload}
          />
        </div>
      )}

      {list.loading && !list.items.length && !list.error && (
        <AdminStateCard tone="loading" title="Đang tải báo lỗi…" />
      )}

      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <AdminStateCard tone="empty" title="Không có báo lỗi nào ở trạng thái này" />
      )}

      {list.items.length > 0 && (
        <div className="flex flex-col gap-3">
          {list.items.map((item) => (
            <ReportCard
              key={item.id}
              item={item}
              action={action}
              onStatus={(target, next) => action.run(target.id, () => patch(target, { status: next }))}
              onNote={(target, note) =>
                // Xoá trắng ghi chú thì gửi null, đúng kiểu `adminNote` nhận được ở máy chủ.
                action.run(target.id, () => patch(target, { adminNote: note.trim() ? note.trim() : null }))
              }
            />
          ))}
        </div>
      )}

      <AdminPager list={list} unit="báo lỗi" />
    </>
  );
}
