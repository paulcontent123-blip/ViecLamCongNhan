"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type { JobWithRelations } from "@/types/db";
import { JobDetailContent } from "@/components/timviec/JobDetailContent";

// Route intercept (@modal/(.)[slug]) render component này thay vì trang đầy đủ
// khi người dùng bấm vào 1 thẻ việc làm từ danh sách /tim-viec-lam ‑ cùng 1
// component JobDetailContent nên nội dung luôn khớp với trang chi tiết đầy đủ,
// chỉ khác phần khung (modal thay vì cả trang).
export function JobDetailModal({ job }: { job: JobWithRelations }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [router]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={() => router.back()}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Đóng"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-[16px] text-brand-navy/50 transition hover:bg-black/10 hover:text-brand-navy"
        >
          ✕
        </button>
        <JobDetailContent job={job} />
      </div>
    </div>,
    document.body,
  );
}
