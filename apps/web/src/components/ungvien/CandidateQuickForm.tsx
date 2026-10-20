"use client";

import { useState } from "react";
import { PROVINCES } from "@/lib/provinces";
import { JOB_INDUSTRIES } from "@/lib/industries";
import { IndustrySelect } from "@/components/shared/IndustrySelect";

interface CandidateBody {
  fullName: FormDataEntryValue | null;
  phone: FormDataEntryValue | null;
  zalo: FormDataEntryValue | undefined;
  province: FormDataEntryValue | undefined;
  desiredIndustry: FormDataEntryValue | undefined;
  desiredSalaryMin: FormDataEntryValue | undefined;
  experienceYears: FormDataEntryValue | undefined;
  jobSlug: string | undefined;
}

type Status =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "confirm"; existingSource: "quick_form" | "job_apply"; pendingBody: CandidateBody }
  | { type: "success"; appliedJobTitle: string | null }
  | { type: "error"; message: string };

export function CandidateQuickForm({ jobSlug }: { jobSlug?: string }) {
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [desiredIndustry, setDesiredIndustry] = useState("");

  async function submitBody(body: CandidateBody & { confirmReplace?: boolean }, formEl?: HTMLFormElement) {
    setStatus({ type: "loading" });

    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status === 409 && data.conflict) {
        setStatus({ type: "confirm", existingSource: data.existingSource, pendingBody: body });
        return;
      }

      if (!res.ok) {
        setStatus({ type: "error", message: data.error ?? "Có lỗi xảy ra, thử lại sau." });
        return;
      }
      setStatus({ type: "success", appliedJobTitle: data.appliedJobTitle });
      formEl?.reset();
    } catch {
      setStatus({ type: "error", message: "Không kết nối được máy chủ, thử lại sau." });
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);

    submitBody(
      {
        fullName: form.get("fullName"),
        phone: form.get("phone"),
        zalo: form.get("zalo") || undefined,
        province: form.get("province") || undefined,
        desiredIndustry: desiredIndustry || undefined,
        desiredSalaryMin: form.get("desiredSalaryMin") || undefined,
        experienceYears: form.get("experienceYears") || undefined,
        jobSlug: jobSlug || undefined,
      },
      formEl,
    );
  }

  if (status.type === "confirm") {
    const isJobApply = status.existingSource === "job_apply";
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <div className="text-[28px]">⚠️</div>
        <div className="mt-2 text-[15px] font-bold text-amber-900">Số điện thoại này đã có thông tin</div>
        <p className="mt-1 text-[13px] text-amber-800">
          {isJobApply
            ? "Bạn đã ứng tuyển một tin trước đó bằng số điện thoại này. Ứng tuyển tiếp sẽ hủy và xóa thông tin ứng tuyển trước đó."
            : "Bạn đã để lại thông tin trước đó bằng số điện thoại này. Gửi lại sẽ hủy và xóa thông tin đã điền trước đó."}
          {" "}Bạn có chắc chắn muốn tiếp tục?
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => submitBody({ ...status.pendingBody, confirmReplace: true })}
            className="rounded-xl bg-brand-orange px-5 py-2.5 text-[13.5px] font-bold text-white shadow-sm transition hover:brightness-105"
          >
            Đồng ý, tiếp tục
          </button>
          <button
            type="button"
            onClick={() => setStatus({ type: "idle" })}
            className="rounded-xl border border-black/10 bg-white px-5 py-2.5 text-[13.5px] font-bold text-brand-navy/70 transition hover:border-black/20"
          >
            Hủy, giữ thông tin cũ
          </button>
        </div>
      </div>
    );
  }

  if (status.type === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="text-[28px]">✅</div>
        <div className="mt-2 text-[15px] font-bold text-emerald-800">Gửi thông tin thành công!</div>
        <p className="mt-1 text-[13px] text-emerald-700">
          {status.appliedJobTitle
            ? `Chúng tôi đã ghi nhận bạn ứng tuyển vào "${status.appliedJobTitle}". Nhà tuyển dụng sẽ liên hệ sớm.`
            : "Nhà tuyển dụng phù hợp sẽ liên hệ trực tiếp với bạn qua SĐT/Zalo đã cung cấp."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <input type="hidden" name="jobSlug" value={jobSlug ?? ""} />

      <label className="mb-3 block text-[12px] font-semibold text-brand-navy/60">
        Họ và tên *
        <input
          name="fullName"
          required
          minLength={2}
          className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Số điện thoại *
          <input
            name="phone"
            required
            minLength={9}
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>
        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Zalo (nếu khác SĐT)
          <input
            name="zalo"
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>
      </div>

      <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
        Tỉnh / Thành phố mong muốn làm việc
        <select
          name="province"
          defaultValue=""
          className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
        >
          <option value="">-- Chọn tỉnh thành --</option>
          {PROVINCES.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Ngành nghề mong muốn
          <IndustrySelect value={desiredIndustry} onChange={setDesiredIndustry} options={JOB_INDUSTRIES} />
        </label>
        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Mức lương mong muốn (triệu/tháng)
          <input
            name="desiredSalaryMin"
            type="number"
            min={0}
            placeholder="Vd: 10"
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>
      </div>

      <label className="mt-3 block text-[12px] font-semibold text-brand-navy/60">
        Số năm kinh nghiệm
        <input
          name="experienceYears"
          type="number"
          min={0}
          placeholder="0 nếu chưa có kinh nghiệm"
          className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
        />
      </label>

      {status.type === "error" && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">
          {status.message}
        </div>
      )}

      <button
        type="submit"
        disabled={status.type === "loading"}
        className="mt-5 w-full rounded-xl bg-brand-orange py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
      >
        {status.type === "loading" ? "Đang gửi..." : "✅ Gửi thông tin tìm việc ‑ Miễn phí"}
      </button>
    </form>
  );
}
