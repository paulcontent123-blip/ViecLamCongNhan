import Link from "next/link";
import { getEmployerSession } from "@/lib/employer-auth";
import { getEmployerCampaigns } from "@/lib/employer";
import { daysLeft } from "@/lib/job-format";
import { ROUTES } from "@/lib/routes";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: "Chờ duyệt", className: "bg-amber-50 text-amber-700" },
  approved: { label: "Đang hiển thị", className: "bg-emerald-50 text-emerald-700" },
  closed: { label: "Đã đóng", className: "bg-black/5 text-brand-navy/50" },
  expired: { label: "Hết hạn", className: "bg-red-50 text-red-600" },
};

export default async function EmployerCampaignsPage() {
  const session = await getEmployerSession();
  if (!session) return null;

  const campaigns = await getEmployerCampaigns(session.employerId);

  if (campaigns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-brand-orange/30 bg-brand-orange-light p-8 text-center">
        <div className="text-[32px]">🏆</div>
        <div className="mt-2 text-[15px] font-bold text-brand-navy">Bạn chưa đăng ký Chiến dịch nào</div>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-brand-navy/55">
          Gói Chiến dịch (1.500.000đ/tin · 60 ngày) cho tin của bạn 1 trang riêng nổi bật, hiển thị ở mục
          &ldquo;Chiến dịch tuyển dụng nổi bật&rdquo; trên trang chủ — mua thêm khi đăng tin mới, độc lập với
          gói thuê bao tài khoản.
        </p>
        <Link
          href={ROUTES.ntdDashboardPostJob}
          className="mt-4 inline-block rounded-lg bg-brand-orange px-5 py-2.5 text-[13px] font-bold text-white transition hover:brightness-105"
        >
          Đăng tin + Chiến dịch →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-extrabold text-brand-navy">🏆 Chiến dịch của tôi</h2>
          <p className="mt-1 text-[13px] text-brand-navy/50">
            Chỉnh sửa banner &amp; nội dung trang chiến dịch riêng cho từng tin ({campaigns.length}).
          </p>
        </div>
        <Link
          href={ROUTES.ntdDashboardPostJob}
          className="rounded-lg bg-brand-orange px-3.5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-105"
        >
          + Chiến dịch mới
        </Link>
      </div>

      <div className="space-y-3">
        {campaigns.map((c) => {
          const status = STATUS_LABEL[c.status] ?? STATUS_LABEL.pending;
          const remaining = daysLeft(c.expires_at);
          return (
            <Link
              key={c.id}
              href={`${ROUTES.ntdDashboardCampaigns}/${c.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm transition hover:border-brand-orange/40 sm:p-5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                  {remaining !== null && (
                    <span className="text-[11.5px] text-brand-navy/40">⏳ Còn {remaining} ngày</span>
                  )}
                </div>
                <div className="mt-1 truncate text-[14px] font-bold text-brand-navy">{c.title}</div>
                <div className="mt-0.5 text-[12px] text-brand-navy/45">
                  {c.view_count.toLocaleString("vi-VN")} lượt xem · {c.apply_count.toLocaleString("vi-VN")} đã nộp
                  · tuyển {c.quantity}
                </div>
                <div className="mt-0.5 text-[12px] font-semibold text-brand-orange">
                  📩 Đã gửi: {c.blast_sent_count.toLocaleString("vi-VN")} ứng viên
                </div>
              </div>
              <span className="shrink-0 text-[12.5px] font-bold text-brand-orange">Sửa trang chiến dịch →</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
