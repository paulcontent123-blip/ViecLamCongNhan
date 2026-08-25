"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CandidateContact {
  phone: string;
  zalo: string | null;
}

export function CandidateRevealButton({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [contact, setContact] = useState<CandidateContact | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReveal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/employer/candidates/${candidateId}/view`, { method: "POST" });
      const data = await res.json();
      if (!data.allowed) {
        setError(data.error ?? "Không thể xem hồ sơ này lúc này.");
        return;
      }
      setContact({ phone: data.candidate.phone, zalo: data.candidate.zalo });
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  if (contact) {
    return (
      <div className="text-[12.5px] text-brand-navy/70">
        📞 {contact.phone}
        {contact.zalo && <span> · 💬 Zalo: {contact.zalo}</span>}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleReveal}
        disabled={loading}
        className="rounded-lg bg-brand-navy px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:bg-brand-orange disabled:opacity-60"
      >
        {loading ? "Đang tải..." : "👁 Xem hồ sơ"}
      </button>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
