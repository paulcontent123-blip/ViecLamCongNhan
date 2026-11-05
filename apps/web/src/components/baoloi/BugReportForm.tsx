"use client";

// Form "Báo lỗi website" cho người dùng đã đăng nhập (Người lao động, Nhà tuyển dụng, Đối tác). Báo lỗi đi tới Admin ở mục
// "Báo lỗi ứng dụng", cùng chỗ với báo lỗi từ app. Gửi lại đúng nội dung trong 10 phút không tạo bản trùng, mỗi người tối đa
// 5 báo lỗi trong 24 giờ (do máy chủ kiểm tra).

import Link from "next/link";
import { useEffect, useState } from "react";
import { MobileStateCard } from "@/components/shared/mobileUi";
import {
  BUG_REPORT_LIMITS,
  REPORTER_ROLE_LABEL,
  buildContextNote,
  detectReporterRole,
  submitBugReport,
} from "@/lib/bug-report-client";
import type { BugReportRole } from "@/lib/bug-reports";
import { MobileApiError } from "@/lib/mobile-session-client";
import { ROUTES } from "@/lib/routes";

const inputClass =
  "mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange disabled:bg-black/5";

/** Chỉ nhận đường dẫn nội bộ của chính web (bỏ domain, tham số) làm "trang gặp lỗi". */
function cleanPath(value: string | null | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "";
    return url.pathname.slice(0, 200);
  } catch {
    return "";
  }
}

export function BugReportForm({ from }: { from?: string }) {
  const [role, setRole] = useState<BugReportRole | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [page, setPage] = useState("");
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ duplicate: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    detectReporterRole().then((value) => alive && setRole(value));
    setPage(cleanPath(from) || cleanPath(document.referrer));
    return () => {
      alive = false;
    };
  }, [from]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !role) return;
    const cleanTitle = title.trim();
    const cleanDesc = description.trim();
    if (cleanTitle.length < BUG_REPORT_LIMITS.titleMin || cleanTitle.length > BUG_REPORT_LIMITS.titleMax) {
      setError(`Tiêu đề từ ${BUG_REPORT_LIMITS.titleMin} đến ${BUG_REPORT_LIMITS.titleMax} ký tự.`);
      return;
    }
    const note = buildContextNote(cleanPath(page));
    if (cleanDesc.length < BUG_REPORT_LIMITS.descriptionMin) {
      setError(`Mô tả tối thiểu ${BUG_REPORT_LIMITS.descriptionMin} ký tự.`);
      return;
    }
    if (cleanDesc.length + note.length > BUG_REPORT_LIMITS.descriptionMax) {
      setError(`Mô tả tối đa ${BUG_REPORT_LIMITS.descriptionMax - note.length} ký tự.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await submitBugReport({ role, title: cleanTitle, description: cleanDesc + note });
      setSent({ duplicate: result.duplicate });
    } catch (err) {
      if (err instanceof MobileApiError && err.status === 401) setNeedsLogin(true);
      else setError(err instanceof Error ? err.message : "Chưa gửi được báo lỗi. Vui lòng thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  if (role === undefined) return <MobileStateCard tone="loading" title="Đang kiểm tra tài khoản…" />;

  if (!role || needsLogin) {
    return (
      <div className="rounded-xl border border-black/5 bg-white p-6 text-center">
        <div className="text-[30px]" aria-hidden="true">
          🔑
        </div>
        <h2 className="mt-2 text-[16px] font-extrabold text-brand-navy">Đăng nhập để gửi báo lỗi</h2>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-brand-navy/55">
          Báo lỗi gắn với tài khoản của bạn để Admin có thể liên hệ khi cần. Hãy đăng nhập bằng tài khoản người lao động, nhà tuyển dụng
          hoặc đối tác rồi quay lại trang này.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href={ROUTES.congNhanLogin} className="rounded-xl bg-brand-orange px-6 py-2.5 text-[13px] font-bold text-white">
            Đăng nhập
          </Link>
          <Link href={ROUTES.dangKy} className="rounded-xl border border-black/10 px-6 py-2.5 text-[13px] font-bold text-brand-navy/60">
            Đăng ký
          </Link>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="text-[34px]" aria-hidden="true">
          ✅
        </div>
        <h2 className="mt-2 text-[16px] font-extrabold text-emerald-800">Đã gửi báo lỗi</h2>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-emerald-700">
          {sent.duplicate
            ? "Báo lỗi này đã được gửi trước đó nên không tạo thêm bản trùng. "
            : ""}
          Cảm ơn bạn. Admin sẽ xem và xử lý.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(null);
            setTitle("");
            setDescription("");
          }}
          className="mt-4 rounded-xl border border-emerald-300 px-5 py-2 text-[13px] font-bold text-emerald-800"
        >
          Gửi báo lỗi khác
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-black/5 bg-white p-6">
      <p className="mb-4 text-[12.5px] text-brand-navy/55">
        Đang gửi với tư cách <strong className="font-bold text-brand-navy">{REPORTER_ROLE_LABEL[role]}</strong>.
      </p>

      <label className="block text-[12px] font-semibold text-brand-navy/60">
        Tiêu đề *
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={BUG_REPORT_LIMITS.titleMax}
          placeholder="VD: Không tải lên được ảnh đại diện"
          disabled={busy}
          className={inputClass}
        />
      </label>

      <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
        Mô tả lỗi *
        <textarea
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={6}
          maxLength={BUG_REPORT_LIMITS.descriptionMax}
          placeholder="Bạn đang làm gì, thấy lỗi gì, và điều gì được mong đợi?"
          disabled={busy}
          className={inputClass}
        />
        <span className="mt-1 block text-right text-[11px] text-brand-navy/40">
          {description.length}/{BUG_REPORT_LIMITS.descriptionMax}
        </span>
      </label>

      <label className="mt-1 block text-[12px] font-semibold text-brand-navy/60">
        Trang gặp lỗi (không bắt buộc)
        <input
          name="page"
          value={page}
          onChange={(event) => setPage(event.target.value)}
          maxLength={200}
          placeholder="/duong-dan-trang"
          disabled={busy}
          className={inputClass}
        />
      </label>

      <p className="mt-3 text-[11.5px] leading-relaxed text-brand-navy/45">
        Đừng nhập mật khẩu hay thông tin nhạy cảm vào báo lỗi. Mỗi người gửi tối đa {5} báo lỗi trong 24 giờ.
      </p>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-2.5 text-[12.5px] font-medium text-red-700" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-brand-orange py-3 text-[14px] font-extrabold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
      >
        {busy ? "Đang gửi…" : "Gửi báo lỗi"}
      </button>
    </form>
  );
}
