"use client";

import { useState } from "react";
import {
  PAYMENT_STATE_LABEL,
  type OrderPaymentView,
  vietQrUrl,
} from "@/lib/payment";

const STATE_CLASS: Record<string, string> = {
  unpaid: "bg-black/5 text-brand-navy/60",
  awaiting: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-black/5 text-brand-navy/45",
  refunded: "bg-blue-100 text-blue-800",
};

const money = (n: number) => `${n.toLocaleString("vi-VN")}đ`;

/**
 * Thông tin thanh toán của một đơn: mã QR, số tài khoản / ví MoMo, nội dung chuyển
 * khoản và nút "Tôi đã thanh toán" (hoàn tác được tới khi Admin xác nhận).
 */
export function PaymentDetail({
  payment,
  onChanged,
  onClose,
}: {
  payment: OrderPaymentView;
  onChanged?: (payment: OrderPaymentView) => void;
  onClose?: () => void;
}) {
  const [order, setOrder] = useState(payment);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = order.status === "pending";
  const isMomo = order.method === "momo";

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* trình duyệt chặn clipboard: NTD vẫn bôi đen chép tay được */
    }
  }

  async function mark(confirmed: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/employer/orders/${order.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không cập nhật được, vui lòng thử lại.");
        return;
      }
      setOrder(data.payment);
      onChanged?.(data.payment);
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="text-[13px] text-brand-navy/55">
        {order.title} · <strong className="text-brand-navy">{money(order.amountVnd)}</strong>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-brand-navy/45">
          Mã đơn <span className="font-mono font-bold text-brand-navy">{order.code}</span>
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATE_CLASS[order.state] ?? STATE_CLASS.unpaid}`}>
          {PAYMENT_STATE_LABEL[order.state]}
        </span>
      </div>

      {open && !order.confirmed && order.rejectReason && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] text-red-700">
          <strong>VEA chưa đối soát được khoản chuyển của bạn:</strong> {order.rejectReason}
          <br />
          Vui lòng chuyển lại/bổ sung rồi bấm «Tôi đã thanh toán».
        </p>
      )}

      {isMomo ? (
        order.wallet ? (
          <>
            {open && order.wallet.qr_url && (
              <div className="mt-4 flex justify-center">
                {/* Ảnh QR do Admin tải lên (link ngoài) nên không dùng next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={order.wallet.qr_url}
                  alt="Mã QR ví MoMo nhận tiền"
                  width={220}
                  height={220}
                  className="rounded-xl border border-black/5 bg-white object-contain p-2"
                />
              </div>
            )}
            <dl className="mt-4 rounded-xl border border-black/5 bg-black/[0.02] px-3">
              <Row label="Ví MoMo" value={order.wallet.phone} mono onCopy={() => copy("no", order.wallet!.phone)} copied={copied === "no"} />
              <Row label="Tên chủ ví" value={order.wallet.owner_name} />
              <Row label="Số tiền" value={money(order.amountVnd)} onCopy={() => copy("amt", String(order.amountVnd))} copied={copied === "amt"} />
              <Row label="Lời nhắn" value={order.code} mono highlight onCopy={() => copy("code", order.code)} copied={copied === "code"} />
            </dl>
          </>
        ) : (
          <MissingDestination code={order.code} />
        )
      ) : order.account ? (
        <>
          {open && (
            <div className="mt-4 flex justify-center">
              {/* Ảnh từ img.vietqr.io (động theo số tiền + nội dung) nên không dùng next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={vietQrUrl(order.account, order.amountVnd, order.code)}
                alt={`Mã VietQR thanh toán ${money(order.amountVnd)}`}
                width={220}
                height={220}
                className="rounded-xl border border-black/5 bg-white p-2"
              />
            </div>
          )}
          <dl className="mt-4 rounded-xl border border-black/5 bg-black/[0.02] px-3">
            <Row label="Ngân hàng" value={order.account.bank_name} />
            <Row label="Số tài khoản" value={order.account.account_no} mono onCopy={() => copy("no", order.account!.account_no)} copied={copied === "no"} />
            <Row label="Chủ tài khoản" value={order.account.account_name} />
            <Row label="Số tiền" value={money(order.amountVnd)} onCopy={() => copy("amt", String(order.amountVnd))} copied={copied === "amt"} />
            <Row label="Nội dung CK" value={order.code} mono highlight onCopy={() => copy("code", order.code)} copied={copied === "code"} />
          </dl>
        </>
      ) : (
        <MissingDestination code={order.code} />
      )}

      {error && (
        <div role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700">
          {error}
        </div>
      )}

      {open && !order.confirmed && (
        <>
          <p className="mt-3 text-[11.5px] text-brand-navy/45">
            Ghi <strong>đúng nội dung chuyển khoản</strong>. Chuyển xong hãy bấm nút bên dưới để VEA đối soát.
          </p>
          <button
            type="button"
            onClick={() => mark(true)}
            disabled={loading}
            className="mt-2.5 w-full rounded-lg bg-gradient-to-r from-brand-orange to-orange-600 py-3 text-[14px] font-bold text-white transition hover:brightness-105 disabled:opacity-60"
          >
            {loading ? "Đang cập nhật..." : "✓ Tôi đã thanh toán"}
          </button>
        </>
      )}

      {open && order.confirmed && (
        <>
          <p className="mt-3 text-[11.5px] text-brand-navy/45">
            Đã ghi nhận. VEA sẽ đối soát và kích hoạt trong vài giờ làm việc. Bấm nhầm? Bạn hoàn tác được
            tới khi đơn được xác nhận.
          </p>
          <button
            type="button"
            onClick={() => mark(false)}
            disabled={loading}
            className="mt-2.5 w-full rounded-lg border border-black/10 py-2.5 text-[13px] font-bold text-brand-navy/60 transition hover:bg-black/5 disabled:opacity-60"
          >
            {loading ? "Đang cập nhật..." : "Tôi chưa chuyển khoản"}
          </button>
        </>
      )}

      {order.status === "paid" && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-[12.5px] text-emerald-800">
          VEA đã nhận được thanh toán cho đơn này. Cảm ơn bạn!
        </p>
      )}
      {order.status === "cancelled" && (
        <p className="mt-3 text-[12.5px] text-brand-navy/50">Đơn này đã bị huỷ. Vui lòng tạo đơn mới nếu bạn vẫn muốn mua.</p>
      )}
      {order.status === "refunded" && (
        <p className="mt-3 text-[12.5px] text-brand-navy/50">Đơn này đã được hoàn tiền.</p>
      )}

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mt-2.5 w-full rounded-lg border border-black/10 py-2.5 text-[13px] font-bold text-brand-navy/60 transition hover:bg-black/5"
        >
          Đóng
        </button>
      )}
    </div>
  );
}

function MissingDestination({ code }: { code: string }) {
  return (
    <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
      Kênh nhận tiền đang được cập nhật. Vui lòng liên hệ VEA kèm mã đơn <strong>{code}</strong> để được
      hướng dẫn thanh toán.
    </p>
  );
}

function Row({
  label,
  value,
  mono,
  highlight,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/5 py-2.5 text-[13px] last:border-b-0">
      <dt className="shrink-0 text-brand-navy/45">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span
          className={`truncate font-semibold ${mono ? "font-mono" : ""} ${
            highlight ? "text-brand-orange" : "text-brand-navy"
          }`}
        >
          {value}
        </span>
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            className="shrink-0 rounded-md bg-black/5 px-2 py-1 text-[11px] font-bold text-brand-navy/55 transition hover:bg-black/10"
          >
            {copied ? "Đã chép" : "Chép"}
          </button>
        )}
      </dd>
    </div>
  );
}
