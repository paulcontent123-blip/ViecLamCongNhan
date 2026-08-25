"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PROVINCES } from "@/lib/provinces";
import { JOB_INDUSTRIES } from "@/lib/industries";
import { JOB_ADDONS } from "@/lib/packages";
import { ACCOUNT_TIERS, type AccountTier } from "@/lib/account-tiers";
import { ROUTES } from "@/lib/routes";
import type { PaymentMethod } from "@/lib/payment-method";
import type { KcnRow } from "@/types/db";
import { PaymentMethodModal } from "@/components/ntd/PaymentMethodModal";
import { IndustrySelect } from "@/components/shared/IndustrySelect";

const featureCheckboxes = [
  { name: "isUrgent", label: "⚡ Tuyển gấp" },
  { name: "hasMeals", label: "🍱 Có bữa ăn ca" },
  { name: "hasShuttle", label: "🚌 Có xe đưa đón" },
  { name: "hasHousing", label: "🏠 Có nhà ở tập thể" },
  { name: "noExperienceRequired", label: "🔰 Không cần kinh nghiệm" },
] as const;

export function PostJobForm({
  verified = true,
  accountTier = "free",
  dailyPostLimit,
  postedToday = 0,
  kcnList = [],
}: {
  verified?: boolean;
  accountTier?: AccountTier;
  dailyPostLimit: number;
  postedToday?: number;
  kcnList?: KcnRow[];
}) {
  const router = useRouter();
  const [industry, setIndustry] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const kcnOptions = provinceCode ? kcnList.filter((k) => k.province_code === provinceCode) : kcnList;
  const [wantsCampaign, setWantsCampaign] = useState(false);
  const [campaignMessage, setCampaignMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingBody, setPendingBody] = useState<Record<string, unknown> | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  // Tự tick sẵn khi đến từ nút "Đăng ký ngay" ở thẻ Chiến dịch trang Đơn hàng & Gói
  // (xem CampaignPurchaseCard.tsx) — đọc query string trực tiếp thay vì useSearchParams
  // để tránh phải bọc Suspense chỉ vì 1 giá trị đọc 1 lần lúc mount.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("campaign") === "1") {
      setWantsCampaign(true);
    }
  }, []);

  const perks = ACCOUNT_TIERS[accountTier];
  const reachedDailyLimit = postedToday >= dailyPostLimit;

  function navigateAfterSuccess(orderId: string | null) {
    if (orderId) {
      router.push(`${ROUTES.ntdDashboardOrders}?justCreated=${orderId}`);
    } else {
      router.push(ROUTES.ntdDashboard);
    }
    router.refresh();
  }

  async function submitJob(
    body: Record<string, unknown>,
  ): Promise<{ ok: true; orderId: string | null } | { ok: false; error: string }> {
    try {
      const res = await fetch("/api/employer/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        const message = data.error ?? "Có lỗi xảy ra, thử lại sau.";
        setError(message);
        return { ok: false, error: message };
      }

      return { ok: true, orderId: data.order?.id ?? null };
    } catch {
      const message = "Không kết nối được máy chủ, thử lại sau.";
      setError(message);
      return { ok: false, error: message };
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    const body = {
      title: form.get("title"),
      description: form.get("description"),
      requirements: form.get("requirements") || undefined,
      salaryMin: form.get("salaryMin") || undefined,
      salaryMax: form.get("salaryMax") || undefined,
      jobType: form.get("jobType") || undefined,
      provinceCode: form.get("provinceCode"),
      district: form.get("district") || undefined,
      kcnId: form.get("kcnId") || undefined,
      industry,
      quantity: form.get("quantity") || undefined,
      wantsCampaign,
      campaignMessage: wantsCampaign ? campaignMessage : undefined,
      shiftType: form.get("shiftType") || undefined,
      ...Object.fromEntries(featureCheckboxes.map((c) => [c.name, form.get(c.name) === "on"])),
    };

    // Gói Chiến dịch trả phí ngay lúc đăng tin — cần chọn phương thức thanh toán
    // giống mọi gói trả phí khác (Basic/Premium, nâng cấp Chiến dịch từ Đơn hàng &
    // Gói) thay vì tạo đơn ngầm không rõ đã chọn phương thức nào.
    if (wantsCampaign) {
      setPendingBody(body);
      setPaymentModalOpen(true);
      return;
    }

    setLoading(true);
    const result = await submitJob(body);
    if (!result.ok) {
      setLoading(false);
      return;
    }
    navigateAfterSuccess(result.orderId);
  }

  async function handlePaymentConfirm(method: PaymentMethod) {
    if (!pendingBody) return { ok: false as const, error: "Thiếu dữ liệu tin đăng, vui lòng thử lại." };
    const result = await submitJob({ ...pendingBody, paymentMethod: method });
    if (!result.ok) return result;
    navigateAfterSuccess(result.orderId);
    return { ok: true as const };
  }

  if (!verified) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
        <div className="text-[32px]">🔒</div>
        <div className="mt-2 text-[15px] font-bold text-brand-navy">Cần xác minh tài khoản để đăng tin</div>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-brand-navy/55">
          Tài khoản của bạn đang chờ Admin xác minh pháp nhân (mã số thuế, giấy phép...). Việc này thường
          mất vài giờ làm việc — bạn sẽ đăng tin được ngay khi tài khoản được xác minh.
        </p>
      </div>
    );
  }

  if (reachedDailyLimit) {
    return (
      <div className="rounded-2xl border border-dashed border-brand-orange/30 bg-brand-orange-light p-8 text-center">
        <div className="text-[32px]">🚀</div>
        <div className="mt-2 text-[15px] font-bold text-brand-navy">
          Đã đăng {postedToday}/{dailyPostLimit} tin hôm nay (gói {perks.label})
        </div>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-brand-navy/55">
          Bạn đã dùng hết hạn mức tin/ngày của gói {perks.label}. Nâng cấp gói để đăng nhiều tin hơn mỗi
          ngày, hoặc quay lại vào ngày mai.
        </p>
        <Link
          href={ROUTES.ntdDashboardOrders}
          className="mt-4 inline-block rounded-lg bg-brand-orange px-5 py-2.5 text-[13px] font-bold text-white transition hover:brightness-105"
        >
          Nâng cấp gói →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-[12px] font-semibold text-brand-navy/60 sm:col-span-2">
          Tiêu đề tuyển dụng *
          <input
            name="title"
            required
            minLength={5}
            placeholder="VD: Tuyển công nhân may mặc — KCN Sóng Thần 2"
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
            defaultValue=""
            onChange={(e) => setProvinceCode(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          >
            <option value="" disabled>
              -- Chọn tỉnh thành --
            </option>
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Khu công nghiệp (không bắt buộc)
          <select
            name="kcnId"
            defaultValue=""
            className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          >
            <option value="">-- Không thuộc KCN nào / KCN chưa có trong danh sách --</option>
            {kcnOptions.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
                {!provinceCode ? ` — ${k.province_name}` : ""}
              </option>
            ))}
          </select>
          {provinceCode && kcnOptions.length === 0 && (
            <span className="mt-1 block text-[11px] font-normal text-brand-navy/40">
              Chưa có KCN nào của tỉnh này trong danh bạ — để trống cũng không sao.
            </span>
          )}
        </label>

        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Địa chỉ / quận huyện cụ thể
          <input
            name="district"
            placeholder="VD: Dĩ An, Bình Dương"
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>

        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Ca làm việc
          <select
            name="shiftType"
            defaultValue=""
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
            defaultValue="full_time"
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
            placeholder="8000000"
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>
        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Lương đến (VNĐ)
          <input
            name="salaryMax"
            type="number"
            min={0}
            placeholder="12000000"
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>

        <label className="block text-[12px] font-semibold text-brand-navy/60">
          Số lượng tuyển
          <input
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>

        <label className="block text-[12px] font-semibold text-brand-navy/60 sm:col-span-2">
          Mô tả công việc & Quyền lợi *
          <textarea
            name="description"
            required
            minLength={20}
            rows={4}
            placeholder="Mô tả chi tiết công việc, quyền lợi..."
            className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
        </label>

        <label className="block text-[12px] font-semibold text-brand-navy/60 sm:col-span-2">
          Yêu cầu ứng viên
          <textarea
            name="requirements"
            rows={2}
            placeholder="VD: 18-40 tuổi, không yêu cầu kinh nghiệm..."
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
                <input type="checkbox" name={c.name} />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-black/5 pt-4">
        <div className="mb-2 text-[12px] font-semibold text-brand-navy/60">Gói tài khoản hiện tại</div>
        <div className="rounded-xl border-2 border-brand-orange bg-brand-orange-light p-3">
          <div className="flex items-center justify-between">
            <div className="text-[12.5px] font-bold text-brand-navy">
              {perks.label} — {postedToday}/{dailyPostLimit} tin hôm nay · Hiển thị {perks.jobDurationDays} ngày
            </div>
            <Link href={ROUTES.ntdDashboardOrders} className="text-[11.5px] font-bold text-brand-orange">
              Nâng cấp gói →
            </Link>
          </div>
        </div>

        <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border-2 border-black/10 p-3 transition hover:border-brand-orange/40">
          <input
            type="checkbox"
            checked={wantsCampaign}
            onChange={(e) => setWantsCampaign(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <div className="text-[12.5px] font-bold text-brand-navy">
              🏆 Mua thêm gói Chiến dịch cho tin này —{" "}
              {(JOB_ADDONS.campaign.priceVnd / 1000).toLocaleString("vi-VN")}K
            </div>
            <div className="mt-0.5 text-[11px] text-brand-navy/45">
              Trang campaign riêng, banner trang chủ, top danh sách · {JOB_ADDONS.campaign.durationDays} ngày
              hiển thị — độc lập với gói tài khoản
            </div>
          </div>
        </label>
        {wantsCampaign && (
          <div className="mt-3">
            <p className="text-[12px] text-brand-navy/50">
              Đăng tin xong hệ thống sẽ tạo đơn hàng {JOB_ADDONS.campaign.priceVnd.toLocaleString("vi-VN")}đ ở
              trạng thái chờ Admin xác nhận đã nhận thanh toán — tin chỉ được nâng lên gói Chiến dịch và tự
              động gửi tin nhắn Zalo cho ứng viên cùng ngành nghề/tỉnh thành (trong hạn mức 1.000.000đ) SAU KHI
              Admin xác nhận, không phải ngay lúc đăng tin.
            </p>
            <label className="mt-2 block text-[12px] font-semibold text-brand-navy/60">
              Nội dung gửi tin nhắn Zalo cho ứng viên *
              <textarea
                value={campaignMessage}
                onChange={(e) => setCampaignMessage(e.target.value)}
                rows={3}
                maxLength={1000}
                required={wantsCampaign}
                minLength={10}
                placeholder="VD: Công ty ABC đang tuyển công nhân may — lương 9-12tr, có nhà ở & xe đưa đón. Liên hệ 090xxxxxxx để ứng tuyển ngay!"
                className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
              />
              <span className="mt-1 block text-[11px] font-normal text-brand-navy/40">
                Nhớ kèm số điện thoại/Zalo liên hệ để ứng viên phản hồi lại được.
              </span>
            </label>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full rounded-xl bg-brand-orange py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {loading ? "Đang đăng tin..." : `🚀 Đăng tin (Gói ${wantsCampaign ? JOB_ADDONS.campaign.label : perks.label})`}
      </button>

      {paymentModalOpen && (
        <PaymentMethodModal
          title="Đăng ký gói Chiến dịch"
          description={`${JOB_ADDONS.campaign.label} — ${JOB_ADDONS.campaign.durationDays} ngày hiển thị`}
          priceVnd={JOB_ADDONS.campaign.priceVnd}
          onConfirm={handlePaymentConfirm}
          onConfirmed={() => setPaymentModalOpen(false)}
          onClose={() => setPaymentModalOpen(false)}
        />
      )}
    </form>
  );
}
