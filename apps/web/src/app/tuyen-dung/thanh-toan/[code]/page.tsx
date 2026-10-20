import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getEmployerSession } from "@/lib/employer-auth";
import { getOrderPaymentByCode } from "@/lib/payment-orders";
import { ROUTES } from "@/lib/routes";
import { PaymentDetail } from "@/components/ntd/PaymentDetail";

// Trang riêng theo mã đơn: không index.
export const metadata: Metadata = {
  title: "Thanh toán đơn hàng | ViecLamCongNhan.com",
  robots: { index: false, follow: false },
};

// Trạng thái đơn đổi theo từng lần xem (NTD tự báo, Admin đối soát).
export const dynamic = "force-dynamic";

export default async function EmployerPaymentPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await getEmployerSession();
  if (!session) redirect(ROUTES.ntdLogin);

  const { code } = await params;
  const payment = await getOrderPaymentByCode(code.toUpperCase(), session.employerId);
  if (!payment) notFound();

  return (
    <div className="px-4 pb-20 pt-8 sm:px-8 lg:px-[52px]">
      <div className="mx-auto max-w-[480px]">
        <Link
          href={ROUTES.ntdDashboardOrders}
          className="text-[13px] font-semibold text-brand-navy/50 hover:text-brand-orange"
        >
          ← Quay lại đơn hàng
        </Link>
        <div className="mt-4 rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
          <h1 className="mb-3 text-[16px] font-extrabold text-brand-navy">💳 Thanh toán đơn hàng</h1>
          <PaymentDetail payment={payment} />
        </div>
        <p className="mt-4 text-center text-[12px] text-brand-navy/40">
          Cần hỗ trợ? Liên hệ VEA kèm mã đơn <span className="font-mono font-semibold">{payment.code}</span>.
        </p>
      </div>
    </div>
  );
}
