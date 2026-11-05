"use client";

// Admin xác nhận tài khoản công nhân. Công nhân đăng ký bằng số điện thoại + mật khẩu nên chưa được xác minh; trên web
// họ chỉ vào được tài khoản sau khi Admin xác nhận ở đây. Dùng route mới `api/mobile/admin/candidate-accounts`.

import { useState } from "react";
import {
  AdminActionAlert,
  AdminFilterChips,
  AdminPager,
  AdminSearch,
  AdminStateCard,
  useAdminAction,
  useAdminMobileList,
} from "@/components/admin/AdminMobileShared";
import { StatusPill } from "@/components/admin/StatusPill";
import { formatDateTime } from "@/lib/format-date";
import { adminPatch } from "@/lib/mobile-admin-client";

type AccountRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  is_verified: boolean;
  created_at: string;
};

const FILTERS = [
  { value: "pending", label: "Chờ xác nhận" },
  { value: "verified", label: "Đã xác nhận" },
  { value: "", label: "Tất cả" },
];

export function CandidateAccountApproval() {
  const [status, setStatus] = useState("pending");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const list = useAdminMobileList<AccountRow>("admin/candidate-accounts", { status, q: query });
  const action = useAdminAction(list.reload);
  const pendingCount = typeof list.extra.pendingCount === "number" ? list.extra.pendingCount : null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminFilterChips options={FILTERS} active={status} onChange={setStatus} />
        {pendingCount !== null && pendingCount > 0 && (
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[12px] font-bold text-amber-700">
            {pendingCount.toLocaleString("vi-VN")} tài khoản chờ xác nhận
          </span>
        )}
      </div>

      <div className="mb-4">
        <AdminSearch draft={draft} onDraftChange={setDraft} onSearch={() => setQuery(draft.trim())} placeholder="Tìm theo họ tên hoặc số điện thoại…" />
      </div>

      <AdminActionAlert action={action} onReload={list.reload} />

      {list.error && (
        <div className="mb-3">
          <AdminStateCard
            tone="error"
            title="Chưa tải được danh sách tài khoản"
            description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
            onRetry={list.reload}
          />
        </div>
      )}
      {list.loading && !list.items.length && !list.error && <AdminStateCard tone="loading" title="Đang tải tài khoản…" />}
      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <AdminStateCard tone="empty" title={status === "pending" ? "Không có tài khoản nào đang chờ xác nhận" : "Không có tài khoản phù hợp"} />
      )}

      {list.items.length > 0 && (
        <div className="flex flex-col gap-3">
          {list.items.map((item) => {
            const busy = action.busyId === item.id;
            const disabled = busy || action.needsReload;
            return (
              <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-extrabold text-brand-navy">{item.full_name || "Công nhân"}</h3>
                    <StatusPill label={item.is_verified ? "Đã xác nhận" : "Chờ xác nhận"} tone={item.is_verified ? "green" : "amber"} />
                  </div>
                  <p className="mt-1 text-[13px] font-semibold text-brand-navy/70">{item.phone || "Chưa có số điện thoại"}</p>
                  <p className="mt-0.5 text-[11.5px] text-brand-navy/40">Đăng ký {formatDateTime(item.created_at)}</p>
                </div>
                {item.is_verified ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (!window.confirm("Thu hồi xác nhận? Người này sẽ không đăng nhập được trên web cho tới khi được xác nhận lại.")) return;
                      action.run(item.id, async () => {
                        await adminPatch(`admin/candidate-accounts/${encodeURIComponent(item.id)}`, { verified: false });
                      });
                    }}
                    className="rounded-lg border border-black/10 px-3.5 py-1.5 text-[12px] font-bold text-brand-navy/60 transition hover:border-red-300 hover:text-red-600 disabled:opacity-40"
                  >
                    {busy ? "Đang lưu…" : "Thu hồi xác nhận"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      action.run(item.id, async () => {
                        await adminPatch(`admin/candidate-accounts/${encodeURIComponent(item.id)}`, { verified: true });
                      })
                    }
                    className="rounded-lg bg-brand-orange px-4 py-1.5 text-[12.5px] font-extrabold text-white transition hover:brightness-110 disabled:opacity-40"
                  >
                    {busy ? "Đang lưu…" : "Xác nhận tài khoản"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      <AdminPager list={list} unit="tài khoản" />
    </>
  );
}
