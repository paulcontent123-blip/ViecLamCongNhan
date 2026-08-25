"use client";

import { useEffect, useState } from "react";
import type { ServiceInquiryRow } from "@/types/db";

const STATUS_LABEL: Record<ServiceInquiryRow["status"], { label: string; className: string }> = {
  new: { label: "Chưa tư vấn", className: "bg-amber-50 text-amber-700" },
  consulted: { label: "Đã tư vấn", className: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Đã hủy đăng ký", className: "bg-red-50 text-red-600" },
};

export function ServiceInquiryDetailButton({ inquiry }: { inquiry: ServiceInquiryRow }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 rounded-lg border border-brand-orange/25 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-orange transition hover:bg-brand-orange-light">
        Xem đầy đủ
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-navy/55 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="service-inquiry-detail-title" className="max-h-[calc(100vh-2rem)] w-full max-w-[620px] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-black/5 px-5 py-4 sm:px-6">
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-brand-orange">Chi tiết yêu cầu tư vấn</div>
                <h2 id="service-inquiry-detail-title" className="mt-1 text-[18px] font-extrabold text-brand-navy">{inquiry.service_name}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng chi tiết yêu cầu" className="rounded-lg px-2 py-1 text-xl leading-none text-brand-navy/40 transition hover:bg-black/5 hover:text-brand-navy">×</button>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div className="grid gap-3 rounded-xl border border-black/5 bg-black/[0.02] p-4 text-[13px] sm:grid-cols-2">
                <div><span className="text-brand-navy/45">Loại: </span><span className="font-semibold text-brand-navy">{inquiry.type}</span></div>
                <div><span className="text-brand-navy/45">Thời gian: </span><span className="font-semibold text-brand-navy">{new Date(inquiry.created_at).toLocaleString("vi-VN")}</span></div>
                <div><span className="text-brand-navy/45">Doanh nghiệp: </span><span className="font-semibold text-brand-navy">{inquiry.company_name}</span></div>
                <div><span className="text-brand-navy/45">Trạng thái: </span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_LABEL[inquiry.status].className}`}>{STATUS_LABEL[inquiry.status].label}</span></div>
                <div><span className="text-brand-navy/45">Số điện thoại: </span><a href={`tel:${inquiry.phone}`} className="font-semibold text-brand-orange">{inquiry.phone}</a></div>
                <div><span className="text-brand-navy/45">Email: </span><a href={`mailto:${inquiry.email}`} className="font-semibold text-brand-orange">{inquiry.email}</a></div>
                {inquiry.kcn_target && <div className="sm:col-span-2"><span className="text-brand-navy/45">KCN / Tỉnh: </span><span className="font-semibold text-brand-navy">{inquiry.kcn_target}</span></div>}
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-brand-navy/45">Yêu cầu của khách hàng</div>
                <div className="mt-2 whitespace-pre-wrap rounded-xl border border-black/5 bg-white p-4 text-[13.5px] leading-relaxed text-brand-navy/70">{inquiry.request || "—"}</div>
              </div>

              {inquiry.cancel_reason && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-red-500">Lý do hủy tư vấn</div>
                  <div className="mt-2 whitespace-pre-wrap rounded-xl border border-red-100 bg-red-50 p-4 text-[13.5px] leading-relaxed text-red-700">{inquiry.cancel_reason}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
