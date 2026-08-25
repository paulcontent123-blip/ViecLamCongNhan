"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminJobStatus } from "@/lib/admin";

export function JobActions({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<AdminJobStatus | null>(null);

  async function setStatus(next: AdminJobStatus) {
    setLoading(next);
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {status === "pending" && (
        <>
          <button
            type="button"
            onClick={() => setStatus("approved")}
            disabled={loading !== null}
            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white transition hover:brightness-105 disabled:opacity-50"
          >
            {loading === "approved" ? "Đang duyệt…" : "✓ Duyệt"}
          </button>
          <button
            type="button"
            onClick={() => setStatus("expired")}
            disabled={loading !== null}
            className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/60 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
          >
            {loading === "expired" ? "…" : "Từ chối"}
          </button>
        </>
      )}
      {status === "approved" && (
        <button
          type="button"
          onClick={() => setStatus("closed")}
          disabled={loading !== null}
          className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/60 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
        >
          {loading === "closed" ? "…" : "Ẩn tin"}
        </button>
      )}
      {(status === "closed" || status === "expired") && (
        <button
          type="button"
          onClick={() => setStatus("approved")}
          disabled={loading !== null}
          className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/60 transition hover:border-brand-orange hover:text-brand-orange disabled:opacity-50"
        >
          {loading === "approved" ? "…" : "Hiện lại"}
        </button>
      )}
    </div>
  );
}
