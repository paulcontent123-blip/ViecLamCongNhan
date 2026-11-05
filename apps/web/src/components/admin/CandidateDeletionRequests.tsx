"use client";

// Admin xử lý yêu cầu xóa tài khoản của người lao động. Người dùng chỉ GỬI yêu cầu; tài khoản chỉ bị xóa khi Admin xác nhận ở
// đây. Dùng route mới `api/mobile/admin/candidate-deletions`.

import { useState } from "react";
import {
  AdminActionAlert,
  AdminFilterChips,
  AdminPager,
  AdminStateCard,
  useAdminAction,
  useAdminMobileList,
} from "@/components/admin/AdminMobileShared";
import { StatusPill } from "@/components/admin/StatusPill";
import { formatDateTime } from "@/lib/format-date";
import { adminPatch } from "@/lib/mobile-admin-client";

type RequestRow = {
  id: string;
  status: string;
  reason: string | null;
  requested_at: string;
  handled_at: string | null;
  admin_note: string | null;
  full_name: string | null;
  phone: string | null;
  account_status: string | null;
};

const FILTERS = [
  { value: "pending", label: "Chờ xử lý" },
  { value: "approved", label: "Đã xóa" },
  { value: "rejected", label: "Đã từ chối" },
  { value: "cancelled", label: "Người dùng rút lại" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xử lý",
  approved: "Đã xóa tài khoản",
  rejected: "Đã từ chối",
  cancelled: "Người dùng rút lại",
};

const STATUS_TONE: Record<string, "amber" | "green" | "red" | "gray"> = {
  pending: "amber",
  approved: "green",
  rejected: "red",
  cancelled: "gray",
};

export function CandidateDeletionRequests() {
  const [status, setStatus] = useState("pending");

  const list = useAdminMobileList<RequestRow>("admin/candidate-deletions", { status });
  const action = useAdminAction(list.reload);
  const pendingCount = typeof list.extra.pendingCount === "number" ? list.extra.pendingCount : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminFilterChips options={FILTERS} active={status} onChange={setStatus} />
        {pendingCount !== null && pendingCount > 0 && (
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[12px] font-bold text-amber-700">
            {pendingCount.toLocaleString("vi-VN")} yêu cầu chờ xử lý
          </span>
        )}
      </div>

      <AdminActionAlert action={action} onReload={list.reload} />

      {list.error && (
        <div className="mb-3">
          <AdminStateCard
            tone="error"
            title="Chưa tải được yêu cầu xóa tài khoản"
            description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
            onRetry={list.reload}
          />
        </div>
      )}
      {list.loading && !list.items.length && !list.error && <AdminStateCard tone="loading" title="Đang tải yêu cầu…" />}
      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <AdminStateCard tone="empty" title="Không có yêu cầu nào ở trạng thái này" />
      )}

      {list.items.length > 0 && (
        <div className="flex flex-col gap-3">
          {list.items.map((item) => {
            const busy = action.busyId === item.id;
            const disabled = busy || action.needsReload;
            const pending = item.status === "pending";
            return (
              <article key={item.id} className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-extrabold text-brand-navy">{item.full_name || "Công nhân"}</h3>
                      <StatusPill label={STATUS_LABEL[item.status] ?? item.status} tone={STATUS_TONE[item.status] ?? "gray"} />
                    </div>
                    <p className="mt-1 text-[13px] font-semibold text-brand-navy/70">{item.phone || "Chưa có số điện thoại"}</p>
                    <p className="mt-0.5 text-[11.5px] text-brand-navy/40">Gửi yêu cầu {formatDateTime(item.requested_at)}</p>
                    {item.reason && <p className="mt-1.5 text-[12.5px] text-brand-navy/60">Lý do: {item.reason}</p>}
                    {item.admin_note && <p className="mt-1.5 text-[12px] text-brand-navy/50">Ghi chú Admin: {item.admin_note}</p>}
                  </div>

                  {pending && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          const ok = window.confirm(
                            `Xác nhận XÓA tài khoản của ${item.full_name || "người dùng này"}?\n\nHồ sơ, ảnh đại diện và đơn ứng tuyển sẽ bị xóa, không thể khôi phục.`,
                          );
                          if (!ok) return;
                          action.run(item.id, async () => {
                            await adminPatch(`admin/candidate-deletions/${encodeURIComponent(item.id)}`, { action: "approve" });
                          });
                        }}
                        className="rounded-lg bg-red-600 px-4 py-1.5 text-[12.5px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-40"
                      >
                        {busy ? "Đang xử lý…" : "Xác nhận xóa"}
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          const note = window.prompt("Từ chối yêu cầu xóa tài khoản. Ghi chú gửi cho người dùng (không bắt buộc):", "");
                          if (note === null) return;
                          action.run(item.id, async () => {
                            await adminPatch(`admin/candidate-deletions/${encodeURIComponent(item.id)}`, {
                              action: "reject",
                              ...(note.trim() ? { note: note.trim() } : {}),
                            });
                          });
                        }}
                        className="rounded-lg border border-black/10 px-3.5 py-1.5 text-[12px] font-bold text-brand-navy/60 transition hover:border-brand-orange hover:text-brand-orange disabled:opacity-40"
                      >
                        Từ chối
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AdminPager list={list} unit="yêu cầu" />
    </>
  );
}
