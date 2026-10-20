"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminQARow as AdminQARowType } from "@/lib/admin";
import { StatusPill } from "@/components/admin/StatusPill";

const STATUS_META = {
  new: { label: "Câu hỏi mới", tone: "amber" as const },
  answered: { label: "Đã trả lời (nội bộ)", tone: "blue" as const },
  published: { label: "Đã đăng công khai (FAQ)", tone: "green" as const },
};

export function QARow({ question }: { question: AdminQARowType }) {
  const router = useRouter();
  const [answer, setAnswer] = useState(question.answer ?? "");
  const [saving, setSaving] = useState<"answer" | "publish" | "unpublish" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(publish: boolean) {
    const action = publish ? "publish" : "answer";
    setSaving(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/qa-questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, publish }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Không lưu được câu trả lời.");
        return;
      }
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setSaving(null);
    }
  }

  async function unpublish() {
    setSaving("unpublish");
    setError(null);
    try {
      const res = await fetch(`/api/admin/qa-questions/${question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unpublish: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Không gỡ được khỏi FAQ.");
        return;
      }
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setSaving(null);
    }
  }

  async function remove() {
    if (!window.confirm("Xoá câu hỏi này? Không thể hoàn tác.")) return;
    setSaving("delete");
    setError(null);
    try {
      const res = await fetch(`/api/admin/qa-questions/${question.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Không xoá được câu hỏi.");
        return;
      }
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setSaving(null);
    }
  }

  const status = STATUS_META[question.status];

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-bold text-brand-navy">{question.question}</div>
          <div className="mt-1 text-[12px] text-brand-navy/45">
            {question.full_name || "Ẩn danh"} · {question.contact ?? "‑"} ·{" "}
            {new Date(question.created_at).toLocaleString("vi-VN")}
          </div>
        </div>
        <StatusPill label={status.label} tone={status.tone} />
      </div>

      <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
        Câu trả lời
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={3}
          placeholder="Nhập câu trả lời cho ứng viên..."
          className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
        />
      </label>

      {error && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-700">{error}</div>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={saving !== null || answer.trim().length < 5}
          className="rounded-lg border border-black/10 px-3 py-2 text-[12px] font-bold text-brand-navy/65 transition hover:border-brand-orange hover:text-brand-orange disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving === "answer" ? "Đang lưu…" : "Lưu câu trả lời (nội bộ)"}
        </button>
        {question.status !== "published" ? (
          <button
            type="button"
            onClick={() => save(true)}
            disabled={saving !== null || answer.trim().length < 5}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-[12px] font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving === "publish" ? "Đang đăng…" : "✓ Duyệt & đăng công khai"}
          </button>
        ) : (
          <button
            type="button"
            onClick={unpublish}
            disabled={saving !== null}
            className="rounded-lg border border-amber-300 px-3 py-2 text-[12px] font-bold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving === "unpublish" ? "Đang gỡ…" : "Gỡ khỏi FAQ công khai"}
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={saving !== null}
          className="rounded-lg border border-red-200 px-3 py-2 text-[12px] font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving === "delete" ? "Đang xoá…" : "Xoá"}
        </button>
      </div>
    </div>
  );
}
