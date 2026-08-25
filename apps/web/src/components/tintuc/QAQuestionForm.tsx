"use client";

import { useState } from "react";

export function QAQuestionForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch("/api/qa-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: formData.get("question"),
          fullName: formData.get("fullName") || undefined,
          contact: formData.get("contact"),
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus("error");
        setError(data?.error ?? "Có lỗi xảy ra, thử lại sau.");
        return;
      }
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
      setError("Không kết nối được máy chủ, thử lại sau.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="text-[26px]">✅</div>
        <div className="mt-1.5 text-[14px] font-bold text-brand-navy">Đã gửi câu hỏi thành công</div>
        <p className="mt-1 text-[12.5px] text-brand-navy/55">
          Đội ngũ VEA Law sẽ phản hồi trong 24 giờ qua thông tin liên hệ bạn đã cung cấp.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-3 text-[12.5px] font-bold text-brand-orange"
        >
          Gửi câu hỏi khác
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-black/5 bg-white p-5 shadow-sm"
    >
      <label className="mb-2.5 block text-[12px] font-semibold text-brand-navy/60">
        Câu hỏi *
        <textarea
          name="question"
          required
          minLength={10}
          rows={4}
          placeholder="VD: Tôi bị chủ không đóng BHXH 2 năm, phải làm gì?"
          className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
        />
      </label>
      <div className="mb-3 grid gap-2.5 sm:grid-cols-2">
        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Họ tên
          <input
            name="fullName"
            placeholder="Nguyễn Văn A"
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>
        <label className="block text-[12px] font-semibold text-brand-navy/60">
          SĐT / Email *
          <input
            name="contact"
            required
            minLength={6}
            placeholder="090..."
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-lg bg-gradient-to-r from-brand-orange to-orange-600 px-6 py-2.5 text-[13.5px] font-bold text-white transition hover:brightness-105 disabled:opacity-60"
      >
        {status === "loading" ? "Đang gửi..." : "Gửi câu hỏi →"}
      </button>
    </form>
  );
}
