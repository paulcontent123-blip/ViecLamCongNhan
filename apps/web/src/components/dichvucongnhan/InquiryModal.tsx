"use client";

import { useEffect, useId } from "react";
import type { InquirySubmit } from "@/components/dichvucongnhan/hooks";
import type { WorkerServiceMeta } from "@/lib/worker-services";

/**
 * Hộp thoại gửi yêu cầu, dùng chung cho cả 5 khu dịch vụ.
 *
 * Chỉ lo phần khung: tiêu đề, tên đối tượng đang hỏi, đóng bằng Escape hoặc bấm ra ngoài, và ba trạng thái
 * sau khi gửi (thành công / chưa xác định / lỗi để sửa). Các ô nhập của từng khu truyền vào qua `children`.
 */
export function InquiryModal({
  service,
  kicker,
  title,
  subject,
  subjectNote,
  state,
  onClose,
  onSubmit,
  submitLabel,
  successTitle,
  successNote,
  disclaimer,
  children,
}: {
  service: WorkerServiceMeta;
  kicker: string;
  title: string;
  subject: string;
  subjectNote?: string | null;
  state: InquirySubmit;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  successTitle: string;
  successNote: string;
  disclaimer?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();

  // Đóng bằng Escape và chặn cuộn trang phía sau, giống hộp thoại tư vấn dịch vụ trọn gói.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const sent = state.phase === "sent";
  const uncertain = state.phase === "uncertain";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-navy/55 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[calc(100vh-2rem)] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/5 px-5 py-4 sm:px-6">
          <div>
            <div className={`text-[11px] font-bold uppercase tracking-widest ${service.accent.text}`}>{kicker}</div>
            <h2 id={titleId} className="mt-1 text-[18px] font-extrabold text-brand-navy">
              {sent ? successTitle : uncertain ? "Cần kiểm tra lại yêu cầu" : title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng form gửi yêu cầu"
            className="rounded-lg px-2 py-1 text-xl leading-none text-brand-navy/40 transition hover:bg-black/5 hover:text-brand-navy"
          >
            ×
          </button>
        </div>

        {sent || uncertain ? (
          <div className="p-6 text-center sm:p-8">
            <div className="text-[34px]">{sent ? "✅" : "⚠️"}</div>
            <h3 className={`mt-2 text-[16px] font-extrabold ${sent ? "text-emerald-800" : "text-amber-800"}`}>
              {sent ? successTitle : "Chưa xác định yêu cầu đã gửi hay chưa"}
            </h3>
            <p className={`mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed ${sent ? "text-emerald-700" : "text-amber-800"}`}>
              {sent ? successNote : state.error}
            </p>
            {sent && state.resultId && (
              <p className="mt-3 text-[12.5px] text-brand-navy/50">
                Mã yêu cầu: <span className="font-bold text-brand-navy/70">{state.resultId}</span>
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`mt-5 rounded-xl px-6 py-2.5 text-[13px] font-bold transition ${service.accent.button}`}
            >
              Đóng
            </button>
          </div>
        ) : (
          <form
            className="p-5 sm:p-6"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <div className={`rounded-xl px-3.5 py-3 text-[12.5px] ${service.accent.tint}`}>
              <div className="font-semibold opacity-70">Bạn đang hỏi về</div>
              <div className="mt-0.5 font-extrabold">{subject}</div>
              {subjectNote && <div className="mt-0.5 text-[12px] font-medium opacity-70">{subjectNote}</div>}
            </div>

            <div className="mt-4 flex flex-col gap-3">{children}</div>

            {state.error && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700" role="alert">
                {state.error}
              </div>
            )}

            <button
              type="submit"
              disabled={state.locked}
              className={`mt-4 w-full rounded-xl py-3 text-[14px] font-extrabold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${service.accent.button}`}
            >
              {state.phase === "sending" ? "Đang gửi…" : submitLabel}
            </button>

            {disclaimer && <p className="mt-3 text-[12px] leading-relaxed text-brand-navy/50">{disclaimer}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
