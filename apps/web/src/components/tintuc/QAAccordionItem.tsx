"use client";

import { useState } from "react";

export function QAAccordionItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-[13.5px] font-bold text-brand-navy"
      >
        {question}
        <span className={`shrink-0 text-brand-orange transition-transform ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      {open && (
        <div className="border-t border-black/5 px-4 py-3.5 text-[13px] leading-relaxed text-brand-navy/65">
          {answer}
        </div>
      )}
    </div>
  );
}
