"use client";

// Nút "Lưu việc" trên trang chi tiết tin tuyển dụng. Việc đã lưu gắn với tài khoản công nhân (lưu trên máy chủ), nên
// chưa đăng nhập thì nút dẫn tới trang đăng nhập thay vì lưu tạm. Lưu và bỏ lưu đều lặp lại an toàn, nên khi chưa rõ kết
// quả có thể bấm thử lại.

import Link from "next/link";
import { useEffect, useState } from "react";
import { isJobSaved, saveJob, unsaveJob } from "@/lib/candidate-matching-client";
import { MobileApiError } from "@/lib/mobile-session-client";
import { ROUTES } from "@/lib/routes";

type State = "loading" | "guest" | "ready";

export function SaveJobButton({ jobId }: { jobId: string }) {
  const [state, setState] = useState<State>("loading");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    isJobSaved(jobId)
      .then((value) => {
        if (!alive) return;
        setSaved(value);
        setState("ready");
      })
      .catch((err) => {
        if (!alive) return;
        // 401: chưa đăng nhập công nhân. Lỗi khác: vẫn cho bấm, máy chủ sẽ báo lại nếu còn lỗi.
        setState(err instanceof MobileApiError && err.status === 401 ? "guest" : "ready");
      });
    return () => {
      alive = false;
    };
  }, [jobId]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (saved) await unsaveJob(jobId);
      else await saveJob(jobId);
      setSaved(!saved);
    } catch (err) {
      if (err instanceof MobileApiError && err.status === 401) setState("guest");
      else setError(err instanceof Error ? err.message : "Chưa thực hiện được.");
    } finally {
      setBusy(false);
    }
  }

  const base =
    "whitespace-nowrap rounded-xl border px-4 py-3 text-[13.5px] font-bold transition disabled:opacity-50";

  if (state === "guest") {
    return (
      <Link href={ROUTES.congNhanLogin} className={`${base} border-black/10 text-brand-navy/70 hover:border-brand-orange hover:text-brand-orange`}>
        🤍 Đăng nhập để lưu
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || state === "loading"}
        aria-pressed={saved}
        className={`${base} ${saved ? "border-brand-orange bg-brand-orange-light text-brand-orange" : "border-black/10 text-brand-navy/70 hover:border-brand-orange hover:text-brand-orange"}`}
      >
        {busy ? "Đang lưu…" : saved ? "❤️ Đã lưu" : "🤍 Lưu việc"}
      </button>
      {error && <span className="mt-1 max-w-[220px] text-right text-[11.5px] text-red-600" role="alert">{error}</span>}
    </div>
  );
}
