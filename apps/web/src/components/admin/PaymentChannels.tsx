"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MomoWalletRow, PaymentAccountRow } from "@/lib/admin-payment";
import { BANKS, vietQrUrl } from "@/lib/payment";

/**
 * Kênh nhận tiền hiện cho NTD ở màn hình thanh toán: tài khoản ngân hàng (sinh mã
 * VietQR) và ví MoMo (ảnh QR do Admin tải lên). Mỗi loại chỉ MỘT bản ghi được bật;
 * tắt hết ví MoMo thì NTD chỉ còn thấy VietQR.
 */
export function PaymentChannels({
  accounts,
  wallets,
}: {
  accounts: PaymentAccountRow[];
  wallets: MomoWalletRow[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BankAccounts accounts={accounts} />
      <MomoWallets wallets={wallets} />
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="text-[13.5px] font-bold text-brand-navy">{title}</div>
      <p className="mb-3 mt-1 text-[12px] text-brand-navy/45">{hint}</p>
      {children}
    </section>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-700">{children}</div>;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[13px] outline-none focus:border-brand-orange";
const labelClass = "block text-[12px] font-semibold text-brand-navy/60";

function BankAccounts({ accounts }: { accounts: PaymentAccountRow[] }) {
  const router = useRouter();
  const [bankCode, setBankCode] = useState(BANKS[0].code as string);
  const [accountNo, setAccountNo] = useState("");
  const [accountName, setAccountName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Thao tác không thành công.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Không kết nối được máy chủ.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const bank = BANKS.find((b) => b.code === bankCode);
    const ok = await send("/api/admin/payment-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankCode, bankName: bank?.name ?? bankCode, accountNo, accountName }),
    });
    if (ok) {
      setAccountNo("");
      setAccountName("");
    }
  }

  return (
    <Card
      title="🏦 Tài khoản nhận tiền (VietQR)"
      hint="Tài khoản đang bật sẽ sinh mã VietQR kèm số tiền + mã đơn cho NTD. Chỉ một tài khoản được bật."
    >
      {error && <ErrorText>{error}</ErrorText>}

      <div className="mb-4 space-y-2">
        {accounts.length === 0 && (
          <div className="rounded-lg border border-dashed border-black/10 px-3 py-4 text-center text-[12.5px] text-brand-navy/40">
            Chưa có tài khoản nào ‑ NTD chưa thanh toán VietQR được.
          </div>
        )}
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className={`rounded-xl border px-3 py-2.5 ${
              acc.is_active ? "border-brand-orange/40 bg-brand-orange-light" : "border-black/10"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-brand-navy">
                  {acc.bank_name} · <span className="font-mono">{acc.account_no}</span>
                </div>
                <div className="truncate text-[12px] text-brand-navy/50">{acc.account_name}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {acc.is_active ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10.5px] font-bold text-emerald-700">
                    Đang bật
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      send(`/api/admin/payment-accounts/${acc.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ activate: true }),
                      })
                    }
                    className="rounded-lg bg-brand-navy px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                  >
                    Bật
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send(`/api/admin/payment-accounts/${acc.id}`, { method: "DELETE" })}
                  className="rounded-lg bg-black/5 px-2.5 py-1 text-[11px] font-bold text-brand-navy/55 disabled:opacity-50"
                >
                  Xoá
                </button>
              </div>
            </div>
            {acc.is_active && (
              <div className="mt-2 flex items-center gap-3">
                {/* Ảnh preview từ img.vietqr.io (ngoài domain) nên không dùng next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={vietQrUrl(acc, 10000, "VLDEMO01")}
                  alt="Xem thử mã VietQR"
                  width={88}
                  height={88}
                  className="rounded-lg border border-black/5 bg-white"
                />
                <span className="text-[11.5px] text-brand-navy/45">
                  Xem thử mã QR (10.000đ, nội dung VLDEMO01) ‑ mã thật sinh theo từng đơn.
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-black/[0.02] p-3">
        <div className="mb-2 text-[12px] font-bold text-brand-navy/70">Thêm tài khoản</div>
        <label className={labelClass}>
          Ngân hàng
          <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} className={inputClass}>
            {BANKS.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className={`${labelClass} mt-2`}>
          Số tài khoản
          <input
            value={accountNo}
            onChange={(e) => setAccountNo(e.target.value)}
            placeholder="0123456789"
            inputMode="numeric"
            className={inputClass}
          />
        </label>
        <label className={`${labelClass} mt-2`}>
          Chủ tài khoản
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="CONG TY VEA GROUP"
            className={inputClass}
          />
        </label>
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="mt-3 w-full rounded-lg bg-brand-orange py-2 text-[12.5px] font-bold text-white transition hover:brightness-105 disabled:opacity-50"
        >
          {busy ? "Đang lưu..." : "Thêm tài khoản"}
        </button>
      </div>
    </Card>
  );
}

function MomoWallets({ wallets }: { wallets: MomoWalletRow[] }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Thao tác không thành công.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Không kết nối được máy chủ.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function uploadQr(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", "momo-qr");
      const res = await fetch("/api/admin/upload-image", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Tải ảnh lên thất bại.");
        return;
      }
      setQrUrl(data.url);
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const ok = await send("/api/admin/momo-wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, ownerName, qrUrl: qrUrl || null, note: note || null }),
    });
    if (ok) {
      setPhone("");
      setOwnerName("");
      setQrUrl("");
      setNote("");
    }
  }

  return (
    <Card
      title="🟣 Ví MoMo nhận tiền"
      hint="Ví đang bật mới hiện lựa chọn MoMo cho NTD; tắt hết ví thì MoMo hiện 'Sắp có'."
    >
      {error && <ErrorText>{error}</ErrorText>}

      <div className="mb-4 space-y-2">
        {wallets.length === 0 && (
          <div className="rounded-lg border border-dashed border-black/10 px-3 py-4 text-center text-[12.5px] text-brand-navy/40">
            Chưa có ví MoMo nào ‑ NTD chỉ thấy VietQR.
          </div>
        )}
        {wallets.map((w) => (
          <div
            key={w.id}
            className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 ${
              w.is_active ? "border-brand-orange/40 bg-brand-orange-light" : "border-black/10"
            }`}
          >
            <div className="flex min-w-0 items-start gap-2.5">
              {w.qr_url && (
                /* Ảnh QR trên Cloudinary (link ngoài) nên không dùng next/image. */
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={w.qr_url}
                  alt={`Mã QR ví MoMo ${w.phone}`}
                  width={56}
                  height={56}
                  className="rounded-lg border border-black/5 bg-white object-contain"
                />
              )}
              <div className="min-w-0">
                <div className="font-mono text-[13px] font-bold text-brand-navy">{w.phone}</div>
                <div className="truncate text-[12px] text-brand-navy/50">{w.owner_name}</div>
                {w.note && <div className="truncate text-[11.5px] text-brand-navy/35">{w.note}</div>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  send(`/api/admin/momo-wallets/${w.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ active: !w.is_active }),
                  })
                }
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold disabled:opacity-50 ${
                  w.is_active ? "bg-emerald-100 text-emerald-700" : "bg-brand-navy text-white"
                }`}
              >
                {w.is_active ? "Đang bật" : "Bật"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => send(`/api/admin/momo-wallets/${w.id}`, { method: "DELETE" })}
                className="rounded-lg bg-black/5 px-2.5 py-1 text-[11px] font-bold text-brand-navy/55 disabled:opacity-50"
              >
                Xoá
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-black/[0.02] p-3">
        <div className="mb-2 text-[12px] font-bold text-brand-navy/70">Thêm ví MoMo</div>
        <label className={labelClass}>
          Số điện thoại ví
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0901234567"
            inputMode="tel"
            className={inputClass}
          />
        </label>
        <label className={`${labelClass} mt-2`}>
          Tên chủ ví
          <input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="CONG TY VEA GROUP"
            className={inputClass}
          />
        </label>
        <label className={`${labelClass} mt-2`}>
          Ảnh mã QR nhận tiền (tải lên hoặc dán link https://)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadQr(file);
            }}
            className="mt-1 w-full text-[12px] text-brand-navy/60 file:mr-2 file:rounded-lg file:border-0 file:bg-black/5 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold"
          />
        </label>
        <input
          value={qrUrl}
          onChange={(e) => setQrUrl(e.target.value)}
          placeholder="https://..."
          className={inputClass}
        />
        <label className={`${labelClass} mt-2`}>
          Ghi chú (nội bộ)
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </label>
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="mt-3 w-full rounded-lg bg-brand-orange py-2 text-[12.5px] font-bold text-white transition hover:brightness-105 disabled:opacity-50"
        >
          {busy ? "Đang lưu..." : "Thêm ví MoMo"}
        </button>
      </div>
    </Card>
  );
}
