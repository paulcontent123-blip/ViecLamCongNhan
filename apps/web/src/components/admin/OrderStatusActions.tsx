"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminOrderStatus, AdminOrderRow } from "@/lib/admin";
import { ORDER_TYPE_LABEL } from "@/lib/order-labels";
import { isPaymentMethod, PAYMENT_METHOD_META } from "@/lib/payment-method";
import { StatusPill } from "@/components/admin/StatusPill";

const STATUS_TONE: Record<string, "amber" | "green" | "gray" | "blue"> = {
  pending: "amber",
  paid: "green",
  cancelled: "gray",
  refunded: "blue",
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-black/5 py-2.5 text-[13px] last:border-b-0">
      <div className="text-brand-navy/45">{label}</div>
      <div className="text-right font-semibold text-brand-navy">{children}</div>
    </div>
  );
}

export function OrderStatusActions({ order, statusLabel }: { order: AdminOrderRow; statusLabel: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<AdminOrderStatus | "reject" | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  // NTD đã bấm "Tôi đã thanh toán" chưa. Đơn cũ (chưa có mã) không qua luồng này nên
  // vẫn duyệt được như trước.
  const claimed = order.customer_confirmed_at !== null || order.code === null;
  const canSyncSubscription = order.status === "paid" && order.order_type === "account_subscription" &&
    (order.tier === "basic" || order.tier === "premium") &&
    Boolean(order.employer_id || order.training_provider_id || order.rental_provider_id || order.insurance_provider_id);

  async function setStatus(next: AdminOrderStatus) {
    setLoading(next);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        router.refresh();
        setDetailOpen(false);
        setError(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Không cập nhật được đơn hàng.");
        setDetailOpen(true);
      }
    } finally {
      setLoading(null);
    }
  }

  /** Đối soát không khớp: trả đơn về cho NTD kèm lý do, đơn vẫn ở trạng thái chờ. */
  async function reject() {
    setLoading("reject");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectReason }),
      });
      if (res.ok) {
        router.refresh();
        setRejectOpen(false);
        setRejectReason("");
        setError(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Không cập nhật được đơn hàng.");
      }
    } finally {
      setLoading(null);
    }
  }

  const actionButtons =
    order.status === "pending" ? (
      <>
        <button
          type="button"
          onClick={() => setStatus("paid")}
          disabled={loading !== null || !claimed}
          title={claimed ? undefined : "NTD chưa bấm «Tôi đã thanh toán» cho đơn này"}
          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white transition hover:brightness-105 disabled:opacity-40"
        >
          {loading === "paid" ? "…" : "Đã nhận tiền"}
        </button>
        {order.customer_confirmed_at !== null && (
          <button
            type="button"
            onClick={() => setRejectOpen(true)}
            disabled={loading !== null}
            className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/60 transition hover:border-amber-300 hover:text-amber-700 disabled:opacity-50"
          >
            Trả lại
          </button>
        )}
        <button
          type="button"
          onClick={() => setStatus("cancelled")}
          disabled={loading !== null}
          className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/60 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
        >
          {loading === "cancelled" ? "…" : "Huỷ"}
        </button>
      </>
    ) : order.status === "paid" ? (
      <>
        {canSyncSubscription && (
          <button
            type="button"
            onClick={() => setStatus("paid")}
            disabled={loading !== null}
            title="Đồng bộ lại quyền lợi theo đơn đã được xác nhận thanh toán"
            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white transition hover:brightness-105 disabled:opacity-50"
          >
            {loading === "paid" ? "Đang đồng bộ…" : "Đồng bộ gói"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setStatus("refunded")}
          disabled={loading !== null}
          className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/60 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
        >
          {loading === "refunded" ? "…" : "Đánh dấu hoàn tiền"}
        </button>
      </>
    ) : null;

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/65 transition hover:border-brand-orange hover:text-brand-orange"
        >
          Chi tiết
        </button>
        {order.status === "pending" && actionButtons}
      </div>

      {rejectOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-navy/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-[15px] font-extrabold text-brand-navy">Trả lại đơn cho NTD</h2>
            <p className="mt-1 text-[12.5px] text-brand-navy/50">
              Đơn quay về trạng thái chờ và NTD thấy lý do này để chuyển lại / bổ sung.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="VD: Chưa thấy khoản chuyển với nội dung này trong sao kê."
              className="mt-3 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-brand-orange"
            />
            {error && (
              <div role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-700">
                {error}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectOpen(false)}
                disabled={loading !== null}
                className="rounded-lg border border-black/10 px-3 py-1.5 text-[12px] font-bold text-brand-navy/60 disabled:opacity-50"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={reject}
                disabled={loading !== null || rejectReason.trim().length < 5}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-40"
              >
                {loading === "reject" ? "…" : "Trả lại đơn"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[15px] font-extrabold text-brand-navy">
                  Đơn hàng {order.code ?? `DH${order.id.slice(0, 8).toUpperCase()}`}
                </h2>
                <p className="mt-1 text-[11.5px] text-brand-navy/45">{order.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="text-xl leading-none text-brand-navy/35 hover:text-brand-navy"
              >
                ×
              </button>
            </div>

            <div className="mt-4">
              <DetailRow label="Trạng thái">
                <StatusPill label={statusLabel} tone={STATUS_TONE[order.status] ?? "amber"} />
              </DetailRow>
              <DetailRow label="Nhà tuyển dụng">{order.employers?.company_name ?? "‑"}</DetailRow>
              {order.employers?.contact_phone && <DetailRow label="SĐT liên hệ">{order.employers.contact_phone}</DetailRow>}
              <DetailRow label="Loại đơn hàng">
                {order.order_type ? ORDER_TYPE_LABEL[order.order_type] ?? order.order_type : "‑"}
              </DetailRow>
              {order.tier && <DetailRow label="Gói">{order.tier}</DetailRow>}
              {order.jobs?.title && <DetailRow label="Tin tuyển dụng liên quan">{order.jobs.title}</DetailRow>}
              <DetailRow label="Số tiền">
                <span className="text-brand-orange">{order.amount.toLocaleString("vi-VN")}đ</span>
              </DetailRow>
              <DetailRow label="Phương thức thanh toán">
                {order.payment_method && isPaymentMethod(order.payment_method)
                  ? `${PAYMENT_METHOD_META[order.payment_method].icon} ${PAYMENT_METHOD_META[order.payment_method].label}`
                  : "‑"}
              </DetailRow>
              {order.payment_ref && <DetailRow label="Mã tham chiếu">{order.payment_ref}</DetailRow>}
              <DetailRow label="NTD báo đã chuyển">
                {order.customer_confirmed_at
                  ? new Date(order.customer_confirmed_at).toLocaleString("vi-VN")
                  : "Chưa báo"}
              </DetailRow>
              {order.reject_reason && <DetailRow label="Lý do đã trả lại">{order.reject_reason}</DetailRow>}
              <DetailRow label="Ngày tạo đơn">{new Date(order.created_at).toLocaleString("vi-VN")}</DetailRow>
              {order.paid_at && (
                <DetailRow label="Ngày xác nhận thanh toán">{new Date(order.paid_at).toLocaleString("vi-VN")}</DetailRow>
              )}
              {order.campaign_message && (
                <div className="border-t border-black/5 py-2.5 text-[13px]">
                  <div className="mb-1 text-brand-navy/45">Nội dung tin nhắn Zalo</div>
                  <div className="rounded-lg bg-black/[0.03] p-2.5 text-brand-navy">{order.campaign_message}</div>
                </div>
              )}
            </div>

            {error && (
              <div role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700">
                {error}
              </div>
            )}

            {actionButtons && (
              <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-black/5 pt-4">{actionButtons}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
