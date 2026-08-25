"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_OPTIONS = [
  { value: "new", label: "Đang tìm việc" },
  { value: "viewed", label: "Đã xem" },
  { value: "contacted", label: "Đã liên hệ" },
  { value: "rejected", label: "Từ chối" },
  { value: "hired", label: "Đã có việc" },
  { value: "inactive", label: "Ngừng hoạt động" },
];

export function CandidateStatusSelect({ candidateId, currentStatus }: { candidateId: string; currentStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const prev = status;
    setStatus(next);
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setStatus(prev);
      } else {
        router.refresh();
      }
    } catch {
      setStatus(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={saving}
      className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[12px] font-semibold text-brand-navy outline-none focus:border-brand-orange disabled:opacity-50"
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
