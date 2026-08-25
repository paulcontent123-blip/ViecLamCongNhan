"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PROVINCES } from "@/lib/provinces";
import { EMPLOYER_INDUSTRIES } from "@/lib/industries";
import { ACCOUNT_TIERS, isAccountTier } from "@/lib/account-tiers";
import type { EmployerProfile } from "@/lib/employer";
import { IndustrySelect } from "@/components/shared/IndustrySelect";

export function ProfileForm({ profile }: { profile: EmployerProfile }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [industry, setIndustry] = useState(profile.industry ?? "");
  const [logoUrl, setLogoUrl] = useState(profile.company_logo_url ?? "");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    setLogoUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/employer/upload-logo", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        setLogoError(data.error ?? "Tải ảnh lên thất bại.");
        return;
      }
      setLogoUrl(data.url);
    } catch {
      setLogoError("Không kết nối được máy chủ, thử lại sau.");
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/employer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.get("companyName"),
          contactPhone: form.get("contactPhone"),
          fullName: form.get("fullName"),
          taxCode: form.get("taxCode") || undefined,
          provinceCode: form.get("provinceCode") || undefined,
          industry: industry || undefined,
          companyLogoUrl: logoUrl || undefined,
        }),
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
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="mb-3 border-b border-black/5 pb-2.5 text-[13px] font-extrabold text-brand-navy">
          🔒 Thông tin không chỉnh sửa ở đây
        </div>
        <div className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
          <div>
            <span className="text-brand-navy/40">Email đăng nhập: </span>
            <span className="font-semibold text-brand-navy">{profile.users?.email ?? "—"}</span>
          </div>
          <div>
            <span className="text-brand-navy/40">Mã công ty: </span>
            <span className="font-mono font-semibold text-brand-navy">{profile.company_slug}</span>
          </div>
          <div>
            <span className="text-brand-navy/40">Xác minh pháp nhân: </span>
            <span className={`font-semibold ${profile.is_verified ? "text-emerald-600" : "text-amber-600"}`}>
              {profile.is_verified ? "Đã xác minh" : "Chưa xác minh"}
            </span>
          </div>
          <div>
            <span className="text-brand-navy/40">Gói tài khoản: </span>
            <span className="font-semibold text-brand-navy">
              {isAccountTier(profile.account_type) ? ACCOUNT_TIERS[profile.account_type].label : profile.account_type}
              {profile.account_type !== "free" && profile.account_tier_expires_at && (
                <> · hết hạn {new Date(profile.account_tier_expires_at).toLocaleDateString("vi-VN")}</>
              )}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="mb-4 border-b border-black/5 pb-2.5 text-[13px] font-extrabold text-brand-navy">
          📋 Thông tin đơn vị tuyển dụng
        </div>

        {!profile.is_verified && (
          <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
            🔒 Tài khoản đang chờ Admin xác minh — chưa thể sửa thông tin đơn vị lúc này.
          </div>
        )}

        <fieldset disabled={!profile.is_verified} className="contents">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-[12px] font-semibold text-brand-navy/60">
            Tên đơn vị / Công ty *
            <input
              name="companyName"
              required
              minLength={2}
              defaultValue={profile.company_name}
              className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
            />
          </label>
          <label className="block text-[12px] font-semibold text-brand-navy/60">
            Mã số thuế
            <input
              name="taxCode"
              defaultValue={profile.tax_code ?? ""}
              placeholder="Chưa cập nhật"
              className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
            />
          </label>

          <label className="block text-[12px] font-semibold text-brand-navy/60">
            Số điện thoại liên hệ *
            <input
              name="contactPhone"
              required
              minLength={9}
              defaultValue={profile.contact_phone}
              className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
            />
          </label>
          <label className="block text-[12px] font-semibold text-brand-navy/60">
            Người phụ trách tuyển dụng *
            <input
              name="fullName"
              required
              minLength={2}
              defaultValue={profile.users?.full_name ?? ""}
              className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
            />
          </label>

          <label className="block text-[12px] font-semibold text-brand-navy/60">
            Tỉnh / Thành phố
            <select
              name="provinceCode"
              defaultValue={profile.province_code ?? ""}
              className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
            >
              <option value="">Chưa cập nhật</option>
              {PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-semibold text-brand-navy/60">
            Ngành nghề
            <IndustrySelect
              value={industry}
              onChange={setIndustry}
              options={EMPLOYER_INDUSTRIES}
              placeholder="Chưa cập nhật"
            />
          </label>

          <div className="block text-[12px] font-semibold text-brand-navy/60 sm:col-span-2">
            Logo công ty
            <div className="mt-1.5 flex items-center gap-4">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Logo công ty"
                  className="h-16 w-16 rounded-lg border border-black/10 bg-white object-contain"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-black/15 text-center text-[10px] text-brand-navy/30">
                  Chưa có
                </div>
              )}
              <label className="cursor-pointer rounded-lg border border-black/10 px-3 py-2 text-[12.5px] font-semibold text-brand-navy hover:border-brand-orange">
                {logoUploading ? "Đang tải lên..." : logoUrl ? "Đổi logo" : "Chọn ảnh từ thiết bị"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoChange}
                  disabled={logoUploading}
                  className="hidden"
                />
              </label>
            </div>
            {logoError && <p className="mt-1.5 text-[12px] font-normal text-red-600">{logoError}</p>}
          </div>
        </div>

        {status === "success" && (
          <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-[13px] font-medium text-emerald-700">
            ✅ Đã cập nhật thông tin.
          </div>
        )}
        {status === "error" && error && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>
        )}

        <button
          type="submit"
          disabled={status === "loading" || logoUploading}
          className="mt-5 rounded-xl bg-brand-orange px-6 py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
        >
          {status === "loading" ? "Đang lưu..." : "💾 Cập nhật thông tin"}
        </button>
        </fieldset>
      </form>
    </div>
  );
}
