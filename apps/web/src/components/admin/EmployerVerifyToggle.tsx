"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function EmployerVerifyToggle({ employerId, verified }: { employerId: string; verified: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/employers/${employerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: !verified }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition disabled:opacity-50 ${
        verified
          ? "border border-black/10 text-brand-navy/60 hover:border-red-300 hover:text-red-600"
          : "bg-emerald-600 text-white hover:brightness-105"
      }`}
    >
      {loading ? "…" : verified ? "Huỷ xác minh" : "✓ Xác minh"}
    </button>
  );
}
