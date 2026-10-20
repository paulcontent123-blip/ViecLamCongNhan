"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PROVINCES } from "@/lib/provinces";
import { JOB_INDUSTRIES } from "@/lib/industries";
import { CAMPAIGN_THEMES, type CampaignTheme } from "@/lib/campaign-theme";
import { IndustrySelect } from "@/components/shared/IndustrySelect";

const featureCheckboxes = [
  { name: "isUrgent", label: "⚡ Tuyển gấp" },
  { name: "hasMeals", label: "🍱 Có bữa ăn ca" },
  { name: "hasShuttle", label: "🚌 Có xe đưa đón" },
  { name: "hasHousing", label: "🏠 Có nhà ở tập thể" },
  { name: "noExperienceRequired", label: "🔰 Không cần kinh nghiệm" },
] as const;

export interface CampaignEditInitial {
  title: string;
  description: string;
  requirements: string;
  salaryMin: string;
  salaryMax: string;
  jobType: string;
  provinceCode: string;
  district: string;
  industry: string;
  quantity: string;
  shiftType: string;
  isUrgent: boolean;
  hasHousing: boolean;
  hasShuttle: boolean;
  hasMeals: boolean;
  noExperienceRequired: boolean;
}

export function CampaignEditForm({
  campaignId,
  initialTheme,
  initialStory,
  initial,
}: {
  campaignId: string;
  initialTheme: CampaignTheme;
  initialStory: string;
  initial: CampaignEditInitial;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<CampaignTheme>(initialTheme);
  const [story, setStory] = useState(initialStory);
  const [industry, setIndustry] = useState(initial.industry);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const form = new FormData(e.currentTarget);

    const body = {
      theme,
      story,
      title: form.get("title"),
      description: form.get("description"),
      requirements: form.get("requirements") || undefined,
      salaryMin: form.get("salaryMin") || undefined,
      salaryMax: form.get("salaryMax") || undefined,
      jobType: form.get("jobType") || undefined,
      provinceCode: form.get("provinceCode"),
      district: form.get("district") || undefined,
      industry,
      quantity: form.get("quantity") || undefined,
      shiftType: form.get("shiftType") || undefined,
      ...Object.fromEntries(featureCheckboxes.map((c) => [c.name, form.get(c.name) === "on"])),
    };

    try {
      const res = await fetch(`/api/employer/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "Có lỗi xảy ra, thử lại sau.");
        return;
      }
      setStatus("success");
      router.refresh();
    } catch {
      setStatus("error");
      setError("Không kết nối được máy chủ, thử lại sau.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 border-b border-black/5 pb-3 text-[13px] font-extrabold text-brand-navy">
        📋 Nội dung tin đăng
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-[12px] font-semibold text-brand-navy/60 sm:col-span-2">
          Tiêu đề tuyển dụng *
          <input
            name="title"
            required
            minLength={5}
            defaultValue={initial.title}
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>

        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Ngành nghề *
          <IndustrySelect value={industry} onChange={setIndustry} options={JOB_INDUSTRIES} required />
        </label>

        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Tỉnh / Thành phố *
          <select
            name="provinceCode"
            required
            defaultValue={initial.provinceCode}
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          >
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[12px] font-semibold text-brand-navy/60">
          KCN / Địa chỉ làm việc
          <input
            name="district"
            defaultValue={initial.district}
            placeholder="VD: KCN Sóng Thần 2, Dĩ An"
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>

        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Ca làm việc
          <select
            name="shiftType"
            defaultValue={initial.shiftType}
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          >
            <option value="">-- Không cố định --</option>
            <option value="day">Ca ngày</option>
            <option value="night">Ca đêm</option>
            <option value="rotating">Ca xoay</option>
          </select>
        </label>

        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Loại hình
          <select
            name="jobType"
            defaultValue={initial.jobType || "full_time"}
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          >
            <option value="full_time">Toàn thời gian</option>
            <option value="part_time">Bán thời gian</option>
            <option value="seasonal">Thời vụ</option>
          </select>
        </label>

        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Lương từ (VNĐ)
          <input
            name="salaryMin"
            type="number"
            min={0}
            defaultValue={initial.salaryMin}
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>
        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Lương đến (VNĐ)
          <input
            name="salaryMax"
            type="number"
            min={0}
            defaultValue={initial.salaryMax}
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>

        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Số lượng tuyển
          <input
            name="quantity"
            type="number"
            min={1}
            defaultValue={initial.quantity}
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>

        <label className="block text-[12px] font-semibold text-brand-navy/60 sm:col-span-2">
          Mô tả công việc &amp; Quyền lợi *
          <textarea
            name="description"
            required
            minLength={20}
            rows={4}
            defaultValue={initial.description}
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>

        <label className="block text-[12px] font-semibold text-brand-navy/60 sm:col-span-2">
          Yêu cầu ứng viên
          <textarea
            name="requirements"
            rows={2}
            defaultValue={initial.requirements}
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>

        <div className="sm:col-span-2">
          <div className="mb-2 text-[12px] font-semibold text-brand-navy/60">Đặc điểm nổi bật</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {featureCheckboxes.map((c) => (
              <label
                key={c.name}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-black/10 px-3 py-2.5 text-[12.5px] text-brand-navy/75"
              >
                <input type="checkbox" name={c.name} defaultChecked={initial[c.name]} />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 mt-6 border-b border-black/5 pb-3 text-[13px] font-extrabold text-brand-navy">
        🎨 Giao diện trang chiến dịch
      </div>

      <div className="mb-2 text-[12px] font-semibold text-brand-navy/60">Màu banner</div>
      <div className="mb-5 grid grid-cols-5 gap-2">
        {Object.entries(CAMPAIGN_THEMES).map(([key, meta]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTheme(key as CampaignTheme)}
            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2.5 transition ${
              theme === key ? "border-brand-orange" : "border-transparent hover:border-black/10"
            }`}
          >
            <span className={`h-8 w-full rounded-lg ${meta.swatchClass}`} />
            <span className="text-[10.5px] font-semibold text-brand-navy/60">{meta.label}</span>
          </button>
        ))}
      </div>

      <label className="block text-[12px] font-semibold text-brand-navy/60">
        Về chiến dịch này{" "}
        <span className="font-normal text-brand-navy/40">(hiển thị riêng, khác mô tả công việc)</span>
        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          rows={6}
          maxLength={2000}
          placeholder="VD: Chiến dịch tuyển 500 công nhân may cho đơn hàng Tết 2027 ‑ môi trường làm việc hiện đại, phúc lợi hấp dẫn, đào tạo tay nghề miễn phí..."
          className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
        />
        <span className="mt-1 block text-right text-[11px] text-brand-navy/40">{story.length}/2000</span>
      </label>

      {status === "success" && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-[13px] font-medium text-emerald-700">
          ✅ Đã lưu trang chiến dịch.
        </div>
      )}
      {status === "error" && error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="mt-5 rounded-xl bg-brand-orange px-6 py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
      >
        {status === "loading" ? "Đang lưu..." : "💾 Lưu trang chiến dịch"}
      </button>
    </form>
  );
}
