"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PartnerActiveToggle({ partnerId, active }: { partnerId: string; active: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
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
        active
          ? "border border-black/10 text-brand-navy/60 hover:border-red-300 hover:text-red-600"
          : "bg-emerald-600 text-white hover:brightness-105"
      }`}
    >
      {loading ? "…" : active ? "Tắt" : "Bật lại"}
    </button>
  );
}
