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
  const [loading, setLoading] = useState<AdminOrderStatus | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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
          disabled={loading !== null}
          className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white transition hover:brightness-105 disabled:opacity-50"
        >
          {loading === "paid" ? "…" : "Xác nhận"}
        </button>
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
      <button
        type="button"
        onClick={() => setStatus("refunded")}
        disabled={loading !== null}
        className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/60 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
      >
        {loading === "refunded" ? "…" : "Đánh dấu hoàn tiền"}
      </button>
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
                  Đơn hàng DH{order.id.slice(0, 8).toUpperCase()}
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
              <DetailRow label="Nhà tuyển dụng">{order.employers?.company_name ?? "—"}</DetailRow>
              {order.employers?.contact_phone && <DetailRow label="SĐT liên hệ">{order.employers.contact_phone}</DetailRow>}
              <DetailRow label="Loại đơn hàng">
                {order.order_type ? ORDER_TYPE_LABEL[order.order_type] ?? order.order_type : "—"}
              </DetailRow>
              {order.tier && <DetailRow label="Gói">{order.tier}</DetailRow>}
              {order.jobs?.title && <DetailRow label="Tin tuyển dụng liên quan">{order.jobs.title}</DetailRow>}
              <DetailRow label="Số tiền">
                <span className="text-brand-orange">{order.amount.toLocaleString("vi-VN")}đ</span>
              </DetailRow>
              <DetailRow label="Phương thức thanh toán">
                {order.payment_method && isPaymentMethod(order.payment_method)
                  ? `${PAYMENT_METHOD_META[order.payment_method].icon} ${PAYMENT_METHOD_META[order.payment_method].label}`
                  : "—"}
              </DetailRow>
              {order.payment_ref && <DetailRow label="Mã tham chiếu">{order.payment_ref}</DetailRow>}
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

            {actionButtons && (
              <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-black/5 pt-4">{actionButtons}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
