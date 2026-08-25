"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusPill } from "@/components/admin/StatusPill";

type ServiceInquiryStatus = "new" | "consulted" | "cancelled";

const STATUS_DISPLAY: Record<ServiceInquiryStatus, { label: string; tone: "amber" | "green" | "red" }> = {
  new: { label: "Chưa tư vấn", tone: "amber" },
  consulted: { label: "Đã tư vấn", tone: "green" },
  cancelled: { label: "Đã hủy đăng ký", tone: "red" },
};

export function ServiceInquiryStatusButton({
  inquiryId,
  currentStatus,
}: {
  inquiryId: string;
  currentStatus: ServiceInquiryStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveStatus(nextStatus: ServiceInquiryStatus) {
    if (nextStatus === status) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/service-inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "Không cập nhật được trạng thái.");
        return;
      }

      setStatus(nextStatus);
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  const display = STATUS_DISPLAY[status];
  const isCancelled = status === "cancelled";

  return (
    <div className="flex min-w-[260px] flex-col items-start gap-1.5">
      <StatusPill label={display.label} tone={display.tone} />
      {!isCancelled && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => saveStatus(status === "consulted" ? "new" : "consulted")}
            disabled={saving}
            className="rounded-lg bg-brand-orange px-3 py-1.5 text-[12px] font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Đang lưu…" : status === "consulted" ? "Chưa trả lời" : "Trả lời"}
          </button>
          <button
            type="button"
            onClick={() => saveStatus("cancelled")}
            disabled={saving}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Đang lưu…" : "Đã hủy đăng ký"}
          </button>
        </div>
      )}
      {error && <span className="max-w-[160px] text-[11px] font-medium text-red-600">{error}</span>}
    </div>
  );
}
