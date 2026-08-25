"use client";

import { useRef, useState } from "react";
import { PROVINCES } from "@/lib/provinces";
import { JOB_INDUSTRIES } from "@/lib/industries";
import { ROUTES } from "@/lib/routes";
import { IndustrySelect } from "@/components/shared/IndustrySelect";
import type { PaymentMethod } from "@/lib/payment-method";
import { PackageCtaButton } from "@/components/tuyendung/PackageCtaButton";
import { PaymentMethodModal } from "@/components/ntd/PaymentMethodModal";

type Channel = "sms" | "zalo" | "combo";

const channels: { id: Channel; icon: string; name: string; price: string }[] = [
  { id: "sms", icon: "📱", name: "SMS", price: "500đ/tin" },
  { id: "zalo", icon: "💬", name: "Zalo OA", price: "300đ/tin" },
  { id: "combo", icon: "🚀", name: "Combo SMS+Zalo", price: "700đ/tin" },
];

type Estimate = { reach: number; recipientCount: number; readRatePct: number; priceVnd: number } | null;
type Result = { blastId: string; order: { id: string }; recipientCount: number } | null;

const BLAST_RATE_NOTE = "300–700đ";

export function BlastTab({ loggedIn, verified }: { loggedIn: boolean; verified?: boolean }) {
  const [campaignName, setCampaignName] = useState("");
  const [channel, setChannel] = useState<Channel>("sms");
  const [message, setMessage] = useState("");
  const [targetProvince, setTargetProvince] = useState("");
  const [targetIndustry, setTargetIndustry] = useState("");
  const [quantity, setQuantity] = useState("");
  const [estimate, setEstimate] = useState<Estimate>(null);
  const [result, setResult] = useState<Result>(null);
  const [loading, setLoading] = useState<"estimate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<"campaignName" | "message" | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const campaignNameRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  if (!loggedIn) {
    return (
      <div className="rounded-2xl border border-dashed border-brand-orange/30 bg-brand-orange-light p-8 text-center">
        <div className="text-[32px]">📲</div>
        <div className="mt-2 text-[15px] font-bold text-brand-navy">Cần đăng nhập để tạo chiến dịch Blast</div>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-brand-navy/55">
          Gửi SMS/Zalo trực tiếp đến ứng viên phù hợp trong database — cần tài khoản Nhà tuyển dụng.
        </p>
        <div className="mt-5">
          <PackageCtaButton
            loggedIn={false}
            href={ROUTES.ntdDashboard}
            label="Tạo tài khoản miễn phí →"
            className="inline-block rounded-xl bg-brand-orange px-6 py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105"
          />
        </div>
      </div>
    );
  }

  if (!verified) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-8 text-center">
        <div className="text-[32px]">🔒</div>
        <div className="mt-2 text-[15px] font-bold text-brand-navy">Cần xác minh tài khoản để gửi Blast</div>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-brand-navy/55">
          Tài khoản của bạn đang chờ Admin xác minh pháp nhân — chiến dịch Blast SMS/Zalo chỉ mở cho nhà
          tuyển dụng đã xác minh để tránh spam tới ứng viên trong database.
        </p>
      </div>
    );
  }

  async function handleEstimate() {
    setLoading("estimate");
    setError(null);
    try {
      const res = await fetch("/api/employer/blast/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          targetProvince: targetProvince || undefined,
          targetIndustry: targetIndustry || undefined,
          quantity: quantity ? Number(quantity) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không ước tính được, thử lại sau.");
        return;
      }
      setEstimate(data);
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setLoading(null);
    }
  }

  function handlePayClick() {
    if (!campaignName.trim()) {
      setFieldError("campaignName");
      setError("Vui lòng nhập Tên chiến dịch trước khi thanh toán.");
      campaignNameRef.current?.focus();
      campaignNameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (message.trim().length < 10) {
      setFieldError("message");
      setError("Vui lòng nhập Nội dung tin nhắn tối thiểu 10 ký tự trước khi thanh toán.");
      messageRef.current?.focus();
      messageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setFieldError(null);
    setError(null);
    setPayModalOpen(true);
  }

  async function handleConfirmPayment(method: PaymentMethod) {
    try {
      const res = await fetch("/api/employer/blast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName,
          channel,
          message,
          targetProvince: targetProvince || undefined,
          targetIndustry: targetIndustry || undefined,
          quantity: quantity ? Number(quantity) : undefined,
          paymentMethod: method,
        }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false as const, error: data.error ?? "Không tạo được chiến dịch." };
      setResult(data);
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "Không kết nối được máy chủ." };
    }
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="text-[32px]">✅</div>
        <div className="mt-2 text-[15px] font-bold text-emerald-800">Đã tạo chiến dịch Blast!</div>
        <p className="mt-2 text-[13px] text-emerald-700">
          Sẽ gửi tới {result.recipientCount.toLocaleString("vi-VN")} ứng viên (mới điền form/ứng tuyển gần
          đây nhất). Đơn hàng đang chờ xác nhận thanh toán — xem chi tiết ở mục Đơn hàng &amp; Gói trong
          dashboard.
        </p>
        <a
          href={ROUTES.ntdDashboardOrders}
          className="mt-5 inline-block rounded-xl bg-brand-orange px-6 py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105"
        >
          Xem đơn hàng →
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-black/5 bg-white p-4">
          <div className="font-mono text-[20px] font-extrabold text-brand-orange">37%</div>
          <div className="mt-0.5 text-[11.5px] text-brand-navy/45">Tỷ lệ đọc SMS trung bình</div>
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-4">
          <div className="font-mono text-[20px] font-extrabold text-brand-orange">4h</div>
          <div className="mt-0.5 text-[11.5px] text-brand-navy/45">Thời gian gửi toàn batch</div>
        </div>
        <div className="rounded-xl border border-black/5 bg-white p-4">
          <div className="font-mono text-[20px] font-extrabold text-brand-orange">{BLAST_RATE_NOTE}</div>
          <div className="mt-0.5 text-[11.5px] text-brand-navy/45">Đơn giá theo kênh</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-violet-700 to-violet-500 px-6 py-4">
          <div className="text-[15px] font-bold text-white">📤 Tạo chiến dịch Blast</div>
          <div className="text-[12px] text-white/70">
            Điền thông tin → Ước tính reach &amp; giá → Thanh toán → Blast
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="block text-[12px] font-semibold text-brand-navy/60 sm:col-span-2">
            Tên chiến dịch
            <input
              ref={campaignNameRef}
              value={campaignName}
              onChange={(e) => {
                setCampaignName(e.target.value);
                if (fieldError === "campaignName") setFieldError(null);
              }}
              placeholder="VD: Tuyển gấp 300 CN may Bình Dương tháng 9"
              className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange ${
                fieldError === "campaignName" ? "border-red-400 ring-2 ring-red-100" : "border-black/10"
              }`}
            />
            {fieldError === "campaignName" && (
              <span className="mt-1 block text-[11px] font-normal text-red-600">Thiếu tên chiến dịch — nhập ở đây.</span>
            )}
          </label>

          <div className="sm:col-span-2">
            <div className="mb-1.5 text-[12px] font-semibold text-brand-navy/60">Kênh gửi</div>
            <div className="grid grid-cols-3 gap-2">
              {channels.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setChannel(c.id)}
                  className={`rounded-xl border-2 p-3 text-center transition ${
                    channel === c.id ? "border-brand-orange bg-brand-orange-light" : "border-black/10"
                  }`}
                >
                  <div className="text-[20px]">{c.icon}</div>
                  <div className="mt-1 text-[12px] font-bold text-brand-navy">{c.name}</div>
                  <div className="text-[11px] text-brand-navy/45">{c.price}</div>
                </button>
              ))}
            </div>
          </div>

          <label className="block text-[12px] font-semibold text-brand-navy/60 sm:col-span-2">
            Nội dung tin nhắn <span className="font-normal text-brand-navy/40">(tối đa 160 ký tự, tối thiểu 10 ký tự)</span>
            <textarea
              ref={messageRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value.slice(0, 160));
                if (fieldError === "message") setFieldError(null);
              }}
              rows={3}
              placeholder="[ViecLamCN] Tuyển gấp 200 CN may mặc tại KCN Sóng Thần, lương 8-12tr, bao ăn ở. Liên hệ: 0909..."
              className={`mt-1.5 w-full rounded-lg border px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange ${
                fieldError === "message" ? "border-red-400 ring-2 ring-red-100" : "border-black/10"
              }`}
            />
            {fieldError === "message" ? (
              <span className="mt-1 block text-[11px] font-normal text-red-600">
                Thiếu nội dung tin nhắn (cần tối thiểu 10 ký tự) — nhập ở đây.
              </span>
            ) : (
              <span className="mt-1 block text-right text-[11px] text-brand-navy/40">{message.length}/160</span>
            )}
          </label>

          <label className="block text-[12px] font-semibold text-brand-navy/60">
            Tỉnh mục tiêu
            <select
              value={targetProvince}
              onChange={(e) => setTargetProvince(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
            >
              <option value="">Tất cả tỉnh thành</option>
              {PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-semibold text-brand-navy/60">
            Ngành mục tiêu
            <IndustrySelect
              value={targetIndustry}
              onChange={setTargetIndustry}
              options={JOB_INDUSTRIES}
              placeholder="Tất cả ngành"
            />
          </label>

          <label className="block text-[12px] font-semibold text-brand-navy/60 sm:col-span-2">
            Số lượng muốn gửi <span className="font-normal text-brand-navy/40">(để trống = gửi hết ứng viên khớp bộ lọc)</span>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="VD: 50"
              className="mt-1.5 w-full max-w-[200px] rounded-lg border border-black/10 px-3 py-2.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-orange"
            />
            <span className="mt-1 block text-[11px] font-normal text-brand-navy/40">
              Ưu tiên gửi cho ứng viên mới điền form/ứng tuyển gần đây nhất trước.
            </span>
          </label>
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={handleEstimate}
            disabled={loading === "estimate"}
            className="rounded-lg bg-gradient-to-r from-violet-700 to-violet-500 px-5 py-2.5 text-[13.5px] font-bold text-white shadow-sm transition disabled:opacity-60"
          >
            {loading === "estimate" ? "Đang ước tính..." : "🔮 Ước tính reach & giá"}
          </button>
        </div>

        {error && <div className="mx-5 mb-5 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>}

        {estimate && (
          <div className="mx-5 mb-5 rounded-xl bg-gradient-to-r from-violet-700 to-violet-500 p-5">
            <div className="mb-3 text-[11px] font-bold text-white/60">📊 Ước tính chiến dịch (dựa trên database ứng viên thật)</div>

            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2.5">
              <span className="font-mono text-[17px] font-extrabold text-white">
                {estimate.reach.toLocaleString("vi-VN")}
              </span>
              <span className="text-[12.5px] font-semibold text-white/85">
                ứng viên khớp đúng bộ lọc tỉnh/ngành bạn chọn
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="font-mono text-[19px] font-extrabold text-violet-100">
                  {estimate.recipientCount.toLocaleString("vi-VN")}
                </div>
                <div className="text-[11px] text-white/50">
                  {estimate.recipientCount < estimate.reach ? "Sẽ nhận tin (đã giới hạn)" : "Sẽ nhận tin (gửi hết)"}
                </div>
              </div>
              <div>
                <div className="font-mono text-[19px] font-extrabold text-violet-100">~{estimate.readRatePct}%</div>
                <div className="text-[11px] text-white/50">Tỷ lệ đọc dự kiến</div>
              </div>
              <div>
                <div className="font-mono text-[21px] font-extrabold text-yellow-300">
                  {estimate.priceVnd.toLocaleString("vi-VN")}đ
                </div>
                <div className="text-[11px] text-white/50">Tổng chi phí</div>
              </div>
            </div>
            {estimate.reach === 0 && (
              <p className="mt-3 text-[12px] text-white/70">
                Chưa có ứng viên nào khớp bộ lọc này trong database — thử bỏ bớt tỉnh/ngành mục tiêu.
              </p>
            )}
            <button
              type="button"
              onClick={handlePayClick}
              disabled={estimate.recipientCount === 0}
              className="mt-4 rounded-lg bg-white px-5 py-2.5 text-[13.5px] font-extrabold text-violet-700 shadow-sm transition disabled:opacity-50"
            >
              💳 Thanh toán &amp; Blast ngay →
            </button>
          </div>
        )}
      </div>

      {payModalOpen && estimate && (
        <PaymentMethodModal
          title="Thanh toán chiến dịch Blast"
          description={`${campaignName} — ${estimate.recipientCount.toLocaleString("vi-VN")} ứng viên · ${channels.find((c) => c.id === channel)?.name}`}
          priceVnd={estimate.priceVnd}
          footNote="Chiến dịch ở trạng thái chờ xác nhận — VEA sẽ gửi Blast sau khi xác minh đã nhận thanh toán."
          onConfirm={handleConfirmPayment}
          onConfirmed={() => setPayModalOpen(false)}
          onClose={() => setPayModalOpen(false)}
        />
      )}
    </div>
  );
}
