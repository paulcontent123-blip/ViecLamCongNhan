"use client";

import { useState } from "react";

interface Props {
  filters: { kind: string; status: string; q: string; category: string; province: string };
  eligible: number;
  maxExport: number;
  /** Tên đối tác để gợi ý khi gõ; vẫn cho nhập tên khác. */
  partnerOptions: { name: string; label: string }[];
}

// Xuất CSV các liên hệ công nhân đã đồng ý chia sẻ theo bộ lọc đang xem. Tệp tải về máy, không lưu trên máy chủ.
// Hệ thống không đánh dấu "đã giao": Admin tự theo dõi đã gửi liên hệ nào cho đối tác nào.
export function WorkerInquiryExport({ filters, eligible, maxExport, partnerOptions }: Props) {
  const [partnerName, setPartnerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const valid = partnerName.trim().length >= 2 && eligible > 0 && eligible <= maxExport;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !valid) return;
    if (!window.confirm(`Xuất ${eligible} liên hệ cho "${partnerName.trim()}"? Hệ thống không đánh dấu đã giao, hãy tự ghi lại để không gửi trùng cho đối tác khác.`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/lead-exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerName: partnerName.trim(), filters: Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Không xuất được dữ liệu.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "du-lieu-lien-he.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice(`Đã xuất ${response.headers.get("X-Row-Count") ?? eligible} liên hệ cho ${partnerName.trim()}.`);
      setPartnerName("");
    } catch {
      setError("Không kết nối được máy chủ. Lần xuất có thể đã được ghi vào nhật ký; hãy xuất lại nếu chưa nhận được tệp.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="text-[11.5px] font-semibold text-brand-navy/50">
        Đối tác nhận *
        <input value={partnerName} onChange={(event) => setPartnerName(event.target.value)} list="lead-partner-options" autoComplete="off" maxLength={120} disabled={busy || eligible === 0} placeholder="Chọn từ gợi ý hoặc gõ tên đơn vị..." className="mt-1 block w-72 rounded-lg border border-black/10 px-3 py-2 text-[12.5px] text-brand-navy outline-none focus:border-brand-orange disabled:opacity-60" />
      </label>
      <button type="submit" disabled={busy || !valid} className="rounded-lg bg-brand-orange px-4 py-2 text-[12.5px] font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? "Đang xuất…" : `Xuất CSV (${eligible})`}
      </button>
      <datalist id="lead-partner-options">
        {partnerOptions.map((option) => <option key={option.name} value={option.name} label={option.label} />)}
      </datalist>
      {eligible > maxExport && <span className="text-[12px] font-medium text-red-600">Quá {maxExport} liên hệ, hãy thu hẹp bộ lọc.</span>}
      {error && <div className="w-full rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</div>}
      {notice && <div className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700">{notice}</div>}
    </form>
  );
}
