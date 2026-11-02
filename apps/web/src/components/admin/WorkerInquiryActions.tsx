"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  kind: string;
  id: string;
  name: string;
  providerName: string;
  routedTo: "admin" | "provider";
  adminStatus: "new" | "contacted" | "closed";
  adminNote: string | null;
  /** Chuyển đối tác đang bật hay tắt (máy chủ quyết định; mặc định tắt). */
  canForward: boolean;
}

// Thao tác của Admin với một yêu cầu dịch vụ của công nhân: ghi chú, đổi trạng thái, đóng, chuyển cho đối tác.
// Mất mạng sau khi gửi thì báo chưa xác định và không tự gửi lại.
export function WorkerInquiryActions({ kind, id, name, providerName, routedTo, adminStatus, adminNote, canForward }: Props) {
  const router = useRouter();
  const [note, setNote] = useState(adminNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const atAdmin = routedTo === "admin";
  const noteChanged = note.trim() !== (adminNote ?? "");

  async function send(body: Record<string, unknown>, confirmText?: string) {
    if (busy) return;
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/mobile/admin/worker-inquiries/${kind}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Không lưu được thay đổi.");
        if (response.status === 409) router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ. Chưa xác định thao tác đã lưu hay chưa; hãy tải lại trang trước khi thử tiếp.");
    } finally {
      setBusy(false);
    }
  }

  const buttonClass = "rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/65 transition hover:border-brand-orange hover:text-brand-orange disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="mt-3 border-t border-black/5 pt-3">
      <label className="block text-[11.5px] font-semibold text-brand-navy/50">
        Ghi chú của Admin
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          rows={2}
          disabled={busy}
          placeholder="Ví dụ: đã gọi lúc 10h, hẹn gọi lại"
          className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-[12.5px] text-brand-navy outline-none focus:border-brand-orange disabled:opacity-60"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {noteChanged && (
          <button type="button" disabled={busy} className={buttonClass} onClick={() => send({ adminNote: note.trim() || null })}>
            {busy ? "Đang lưu…" : "Lưu ghi chú"}
          </button>
        )}
        {atAdmin && (
          <>
            <button type="button" disabled={busy} className={buttonClass} onClick={() => send({ adminStatus: adminStatus === "contacted" ? "new" : "contacted" })}>
              {adminStatus === "contacted" ? "Chưa liên hệ" : "Đã liên hệ"}
            </button>
            <button
              type="button"
              disabled={busy}
              className={buttonClass}
              onClick={() =>
                adminStatus === "closed"
                  ? send({ adminStatus: "new" })
                  : send({ adminStatus: "closed" }, `Đóng yêu cầu của ${name}? Yêu cầu sẽ không được chuyển cho đối tác; có thể mở lại sau.`)
              }
            >
              {adminStatus === "closed" ? "Mở lại" : "Đóng"}
            </button>
            {canForward && adminStatus !== "closed" && (
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-brand-orange px-2.5 py-1.5 text-[11.5px] font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() =>
                  send(
                    { forward: true },
                    `Chuyển yêu cầu của ${name} cho ${providerName}? Đối tác sẽ thấy yêu cầu và có thể mở số điện thoại theo hạn mức gói của họ. Không thể rút lại sau khi chuyển.`,
                  )
                }
              >
                Chuyển đối tác
              </button>
            )}
          </>
        )}
      </div>
      {error && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</div>}
    </div>
  );
}
