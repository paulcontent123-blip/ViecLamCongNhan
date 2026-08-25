"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_OPTIONS = [
  { value: "new", label: "Mới" },
  { value: "viewed", label: "Đã xem" },
  { value: "contacted", label: "Đã liên hệ" },
  { value: "hired", label: "Đã tuyển" },
  { value: "rejected", label: "Từ chối" },
];

export function ApplicationStatusSelect({
  applicationId,
  currentStatus,
  verified = true,
}: {
  applicationId: string;
  currentStatus: string;
  verified?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const prev = status;
    setStatus(next);
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/employer/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatus(prev);
        setError(data?.error ?? "Không lưu được trạng thái ứng viên.");
      } else {
        router.refresh();
      }
    } catch {
      setStatus(prev);
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={status}
        onChange={handleChange}
        disabled={saving || !verified}
        title={verified ? undefined : "Cần Admin xác minh tài khoản trước khi cập nhật ứng viên"}
        aria-label="Cập nhật trạng thái đơn ứng tuyển"
        className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[12.5px] font-semibold text-brand-navy outline-none focus:border-brand-orange disabled:opacity-50"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="max-w-56 text-right text-[11px] font-medium text-red-600">{error}</span>}
    </div>
  );
}
