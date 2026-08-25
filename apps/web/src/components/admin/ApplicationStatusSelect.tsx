"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  type ApplicationStatus,
} from "@/lib/application-status";

export function AdminApplicationStatusSelect({
  applicationId,
  currentStatus,
}: {
  applicationId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as ApplicationStatus;
    const previous = status;
    setStatus(next);
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setStatus(previous);
        setError(data?.error ?? "Không lưu được trạng thái đơn ứng tuyển.");
      } else {
        router.refresh();
      }
    } catch {
      setStatus(previous);
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-w-36 flex-col gap-1">
      <select
        value={status}
        onChange={handleChange}
        disabled={saving}
        aria-label="Cập nhật trạng thái đơn ứng tuyển trong Admin"
        className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[12px] font-semibold text-brand-navy outline-none focus:border-brand-orange disabled:opacity-50"
      >
        {APPLICATION_STATUSES.map((option) => (
          <option key={option} value={option}>
            {APPLICATION_STATUS_LABEL[option]}
          </option>
        ))}
      </select>
      {error && <span className="text-[11px] font-medium text-red-600">{error}</span>}
    </div>
  );
}
