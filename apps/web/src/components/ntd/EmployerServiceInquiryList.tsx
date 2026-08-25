"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ServiceInquiryRow } from "@/types/db";

const TYPE_LABEL: Record<string, string> = {
  "Dịch vụ trọn gói": "Dịch vụ trọn gói",
  "Quảng cáo/Hợp tác": "Quảng cáo theo KCN",
  "Đối tác dịch vụ": "Đối tác dịch vụ",
  "Bảng giá quảng cáo": "Bảng giá quảng cáo",
};

const STATUS_LABEL: Record<ServiceInquiryRow["status"], { label: string; className: string }> = {
  new: { label: "Chưa tư vấn", className: "bg-amber-50 text-amber-700" },
  consulted: { label: "Đã tư vấn", className: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Đã hủy đăng ký", className: "bg-red-50 text-red-600" },
};

export function EmployerServiceInquiryList({ inquiries }: { inquiries: ServiceInquiryRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(inquiries);
  const [cancelTarget, setCancelTarget] = useState<ServiceInquiryRow | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCancel(inquiry: ServiceInquiryRow) {
    setCancelTarget(inquiry);
    setReason("");
    setError(null);
  }

  function closeCancel() {
    if (saving) return;
    setCancelTarget(null);
    setReason("");
    setError(null);
  }

  async function handleCancel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cancelTarget) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/employer/service-inquiries/${cancelTarget.id}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Không hủy được yêu cầu tư vấn.");
        return;
      }

      const updated = data?.inquiry as ServiceInquiryRow;
      setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      closeCancel();
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
        Số điện thoại tài khoản này chưa có dịch vụ nào được đặt tư vấn.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-black/5 text-[11px] uppercase tracking-wide text-brand-navy/40">
              <th className="px-4 py-3 font-semibold">Thời gian</th>
              <th className="px-4 py-3 font-semibold">Loại</th>
              <th className="px-4 py-3 font-semibold">Dịch vụ</th>
              <th className="px-4 py-3 font-semibold">Yêu cầu</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inquiry) => {
              const status = STATUS_LABEL[inquiry.status];
              return (
                <tr key={inquiry.id} className="border-t border-black/5 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-[11.5px] text-brand-navy/50">
                    {new Date(inquiry.created_at).toLocaleString("vi-VN")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-brand-navy/55">{TYPE_LABEL[inquiry.type] ?? inquiry.type}</td>
                  <td className="max-w-[220px] px-4 py-3 font-bold text-brand-orange">{inquiry.service_name}</td>
                  <td className="max-w-[280px] px-4 py-3 text-brand-navy/60">
                    <div className="line-clamp-3 whitespace-pre-wrap leading-relaxed">{inquiry.request}</div>
                    {inquiry.kcn_target && <div className="mt-1 text-[11.5px] text-brand-navy/45">KCN/Tỉnh: {inquiry.kcn_target}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>
                      {status.label}
                    </span>
                    {inquiry.status === "new" && (
                      <button
                        type="button"
                        onClick={() => openCancel(inquiry)}
                        className="mt-2 block rounded-lg border border-red-200 px-2.5 py-1.5 text-[11.5px] font-bold text-red-600 transition hover:bg-red-50"
                      >
                        Hủy tư vấn
                      </button>
                    )}
                    {inquiry.status === "cancelled" && inquiry.cancel_reason && (
                      <div className="mt-2 max-w-[190px] text-[11.5px] leading-relaxed text-red-600/75">Lý do: {inquiry.cancel_reason}</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cancelTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-navy/55 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCancel();
          }}
        >
          <form onSubmit={handleCancel} className="w-full max-w-[500px] rounded-2xl bg-white p-5 shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="cancel-service-inquiry-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-red-500">Hủy yêu cầu tư vấn</div>
                <h2 id="cancel-service-inquiry-title" className="mt-1 text-[17px] font-extrabold text-brand-navy">{cancelTarget.service_name}</h2>
              </div>
              <button type="button" onClick={closeCancel} disabled={saving} aria-label="Đóng form hủy tư vấn" className="rounded-lg px-2 py-1 text-xl leading-none text-brand-navy/40 hover:bg-black/5">×</button>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-brand-navy/60">Vui lòng cho biết lý do bạn muốn hủy tư vấn. Thông tin này sẽ được gửi đến Admin.</p>
            <label className="mt-4 block text-[12px] font-semibold text-brand-navy/60">
              Lý do hủy tư vấn *
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} required minLength={3} maxLength={1000} rows={5} placeholder="Ví dụ: Tôi đã thay đổi nhu cầu..." className="mt-1.5 w-full resize-y rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none transition focus:border-brand-orange" />
            </label>
            {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700">{error}</div>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeCancel} disabled={saving} className="rounded-lg border border-black/10 px-3.5 py-2.5 text-[12.5px] font-bold text-brand-navy/60 disabled:opacity-50">Đóng</button>
              <button type="submit" disabled={saving} className="rounded-lg bg-red-600 px-3.5 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-red-700 disabled:opacity-60">{saving ? "Đang hủy…" : "Xác nhận hủy tư vấn"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
