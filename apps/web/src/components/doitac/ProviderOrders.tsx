"use client";

// Gói & đơn hàng của một đối tác: xem Basic/Premium, tạo đơn chờ Admin đối soát, theo dõi lịch sử đơn.
// Hệ thống KHÔNG tự thu tiền: đối tác chuyển khoản hoặc chuyển MoMo rồi bấm "Tôi đã chuyển tiền", Admin xác nhận.
//
// Dùng chung cho Học nghề, Bảo hiểm, Tài chính, Thuê trọ: route `orders`, `payment-methods`, `orders/[code]` của bốn
// loại có cùng hình dạng, chỉ khác tên trường hạn mức trong từng gói (`learnerContactLimit`, `inquiryContactLimit`,
// `tenantContactLimit`) nên cổng nào cũng truyền `limitKey` của mình.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { StatusPill } from "@/components/admin/StatusPill";
import type { ProviderAccent } from "@/components/doitac/FieldGrid";
import { PortalHeading } from "@/components/doitac/PortalChrome";
import { MobileActionAlert, MobilePager, MobileStateCard } from "@/components/shared/mobileUi";
import { messageOf, useMobileAction, useMobileList } from "@/components/shared/useMobileList";
import { formatDateTime } from "@/lib/format-date";
import type { ProviderOrdersApi } from "@/lib/provider-shared-client";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_METHOD_LABEL } from "@/lib/training-provider-portal";

const text = (value: unknown) => (typeof value === "string" ? value : "");
const money = (value: unknown) =>
  Number.isSafeInteger(value) ? `${(value as number).toLocaleString("vi-VN")}đ` : "—";

type Plan = { key: string; label: string; priceVnd: number; billingCycleDays: number } & Record<string, unknown>;
type Account = { tier: string; label: string; expiresAt: string | null; verified: boolean };

function PaymentPanel({
  api,
  code,
  accent,
  onClose,
}: {
  api: ProviderOrdersApi;
  code: string;
  accent: ProviderAccent;
  onClose: () => void;
}) {
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setPayment(await api.getOrderPayment(code));
    } catch (err) {
      setError(messageOf(err, "Chưa tải được chi tiết thanh toán."));
    }
  }, [api, code]);

  useEffect(() => {
    load();
  }, [load]);

  const account = payment?.account as Record<string, unknown> | null | undefined;
  const wallet = payment?.wallet as Record<string, unknown> | null | undefined;
  const confirmed = payment?.confirmed === true;

  async function confirm() {
    if (busy || confirmed) return;
    setBusy(true);
    setError("");
    try {
      await api.setOrderConfirmed(code, true);
      setNotice("Đã báo chuyển tiền. Admin sẽ đối soát và kích hoạt gói.");
      await load();
    } catch (err) {
      setError(messageOf(err, "Chưa gửi được thông báo thanh toán."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-black/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className={`text-[12px] font-bold uppercase tracking-wider ${accent.text}`}>Đơn chờ thanh toán</div>
          <div className="mt-1 text-[18px] font-extrabold text-brand-navy">Mã đơn {code}</div>
          {payment && (
            <p className="mt-1 text-[12.5px] text-brand-navy/55">
              {text(payment.title) || "Gói dịch vụ"} · {money(payment.amountVnd)} ·{" "}
              {PAYMENT_METHOD_LABEL[text(payment.method)] ?? text(payment.method)}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} className="text-[12.5px] font-bold text-brand-navy/40 hover:text-brand-orange">
          Đóng
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-[12.5px] font-medium text-emerald-800" role="status">
          {notice}
        </div>
      )}

      {account && (
        <dl className="mt-3 rounded-lg bg-[#f6f7f9] px-4 py-3 text-[13px]">
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-brand-navy/45">Ngân hàng</dt>
            <dd className="font-bold text-brand-navy">{text(account.bankName)}</dd>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-brand-navy/45">Số tài khoản</dt>
            <dd className="font-extrabold text-brand-navy">{text(account.accountNumber)}</dd>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-brand-navy/45">Chủ tài khoản</dt>
            <dd className="font-bold text-brand-navy">{text(account.accountHolder)}</dd>
          </div>
        </dl>
      )}
      {wallet && (
        <dl className="mt-3 rounded-lg bg-[#f6f7f9] px-4 py-3 text-[13px]">
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-brand-navy/45">Ví MoMo</dt>
            <dd className="font-extrabold text-brand-navy">{text(wallet.phone)}</dd>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-brand-navy/45">Chủ ví</dt>
            <dd className="font-bold text-brand-navy">{text(wallet.ownerName)}</dd>
          </div>
        </dl>
      )}

      <p className="mt-3 text-[12.5px] leading-relaxed text-brand-navy/55">
        Ghi <strong className="font-extrabold">{code}</strong> trong nội dung chuyển khoản để Admin đối soát đúng đơn.
        Hệ thống không tự nhận tiền: gói chỉ được kích hoạt sau khi Admin xác nhận.
      </p>

      <button
        type="button"
        disabled={busy || confirmed}
        onClick={confirm}
        className={`mt-3 rounded-xl px-5 py-2.5 text-[13px] font-extrabold transition disabled:opacity-50 ${accent.button}`}
      >
        {confirmed ? "Đã báo chuyển tiền" : busy ? "Đang gửi…" : "Tôi đã chuyển tiền"}
      </button>
    </div>
  );
}

export function ProviderOrders({
  api,
  loginHref,
  accent,
  title,
  description,
  limitKey,
  limitText,
}: {
  api: ProviderOrdersApi;
  loginHref: string;
  accent: ProviderAccent;
  title: string;
  description: string;
  /** Tên trường hạn mức trong từng gói của route này. */
  limitKey: string;
  /** Phần chữ sau con số hạn mức, ví dụ "lượt mở liên hệ tư vấn mỗi tháng". */
  limitText: string;
}) {
  const router = useRouter();
  const [methods, setMethods] = useState<{ bank_transfer: boolean; momo: boolean } | null>(null);
  const [method, setMethod] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);

  const expired = useCallback(() => router.replace(loginHref), [router, loginHref]);
  const list = useMobileList<Record<string, unknown>>((params) => api.listOrders(params), {}, { onSessionExpired: expired });
  const action = useMobileAction(list.reload, expired);

  useEffect(() => {
    api
      .getPaymentMethods()
      .then((result) => {
        setMethods(result);
        setMethod(result.bank_transfer ? "bank_transfer" : result.momo ? "momo" : "");
      })
      .catch(() => setMethods({ bank_transfer: false, momo: false }));
  }, [api]);

  const plans = (list.extra.plans as Plan[] | undefined) ?? [];
  const account = list.extra.account as Account | undefined;

  const buy = useCallback(
    (tier: string) =>
      action.run(`plan-${tier}`, async () => {
        const code = await api.createOrder(tier, method);
        setOpenCode(code);
      }),
    [action, api, method],
  );

  const noMethod = methods !== null && !methods.bank_transfer && !methods.momo;

  return (
    <>
      <PortalHeading title={title} description={description} />

      {account && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed ${accent.tint}`}>
          Gói hiện tại: <strong className="font-extrabold">{account.label}</strong>
          {account.expiresAt ? ` · hạn đến ${formatDateTime(account.expiresAt)}` : " · không giới hạn thời gian"}
          {!account.verified ? " · chưa được Admin xác minh nên chưa mua gói được." : ""}
        </div>
      )}

      {openCode && <PaymentPanel api={api} code={openCode} accent={accent} onClose={() => setOpenCode(null)} />}

      <MobileActionAlert action={action} onReload={list.reload} />

      {plans.length > 0 && (
        <div className="mb-5">
          {methods && !noMethod && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] text-brand-navy/55">
              <span className="font-semibold">Thanh toán bằng</span>
              {(["bank_transfer", "momo"] as const)
                .filter((value) => methods[value])
                .map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMethod(value)}
                    aria-pressed={method === value}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition ${
                      method === value ? `${accent.border} ${accent.tint}` : "border-black/10 bg-white text-brand-navy/55"
                    }`}
                  >
                    {PAYMENT_METHOD_LABEL[value]}
                  </button>
                ))}
            </div>
          )}
          {noMethod && (
            <div className="mb-3 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800">
              Chưa có kênh nhận tiền nào được cấu hình. Liên hệ Admin trước khi tạo đơn.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => {
              const limit = plan[limitKey];
              const busyHere = action.busyId === `plan-${plan.key}`;
              return (
                <article key={plan.key} className="rounded-xl border border-black/5 bg-white p-5">
                  <div className="text-[15px] font-extrabold text-brand-navy">{plan.label}</div>
                  <div className={`mt-1 text-[22px] font-extrabold ${accent.text}`}>{money(plan.priceVnd)}</div>
                  <p className="mt-1 text-[12.5px] text-brand-navy/50">
                    {plan.billingCycleDays} ngày
                    {typeof limit === "number" ? ` · ${limit.toLocaleString("vi-VN")} ${limitText}` : ""}
                  </p>
                  <button
                    type="button"
                    disabled={busyHere || action.needsReload || !method || account?.verified === false}
                    title={account?.verified === false ? "Cần được Admin xác minh trước khi mua gói" : undefined}
                    onClick={() => buy(plan.key)}
                    className={`mt-4 w-full rounded-xl py-2.5 text-[13px] font-extrabold transition disabled:opacity-50 ${accent.button}`}
                  >
                    {busyHere ? "Đang tạo đơn…" : `Tạo đơn ${plan.label}`}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="mb-2.5 text-[14px] font-extrabold text-brand-navy">Lịch sử đơn hàng</h2>

      {list.error && (
        <div className="mb-3">
          <MobileStateCard
            tone="error"
            title="Chưa tải được gói và đơn hàng"
            description={list.items.length ? `Đang giữ dữ liệu đã tải trước đó. ${list.error}` : list.error}
            onRetry={list.reload}
          />
        </div>
      )}

      {list.loading && !list.items.length && !list.error && <MobileStateCard tone="loading" title="Đang tải đơn hàng…" />}

      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <MobileStateCard tone="empty" title="Chưa có đơn hàng nào" />
      )}

      {list.items.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {list.items.map((order) => {
            const code = text(order.code);
            const status = text(order.status);
            return (
              <article key={text(order.id)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/5 bg-white p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-extrabold text-brand-navy">
                      {code || "Chưa có mã"} · {String(order.tier ?? "").toUpperCase()}
                    </span>
                    <StatusPill label={ORDER_STATUS_LABEL[status] ?? status} tone={ORDER_STATUS_TONE[status] ?? "gray"} />
                  </div>
                  <p className="mt-1 text-[12px] text-brand-navy/45">
                    {money(order.amount)} · {PAYMENT_METHOD_LABEL[text(order.payment_method)] ?? (text(order.payment_method) || "—")} · tạo{" "}
                    {formatDateTime(text(order.created_at))}
                    {order.customer_confirmed_at ? " · đã báo chuyển tiền" : ""}
                  </p>
                  {text(order.reject_reason) && (
                    <p className="mt-1 text-[12px] text-red-600">Lý do từ chối: {text(order.reject_reason)}</p>
                  )}
                </div>
                {code && status === "pending" && (
                  <button
                    type="button"
                    onClick={() => setOpenCode(code)}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-bold ${accent.border} ${accent.text}`}
                  >
                    Tiếp tục thanh toán
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      <MobilePager list={list} unit="đơn hàng" />
    </>
  );
}
