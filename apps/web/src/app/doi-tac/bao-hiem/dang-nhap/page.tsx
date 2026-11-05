import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InsuranceLoginForm } from "@/components/doitac/InsurancePortal";
import { getInsuranceProviderSession } from "@/lib/insurance-provider-auth";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Đăng nhập đối tác bảo hiểm | ViecLamCongNhan.com",
  description: "Đăng nhập cổng đối tác bảo hiểm của ViecLamCongNhan.com.",
};

export const dynamic = "force-dynamic";

export default async function BaoHiemDoiTacLoginPage() {
  // Đã đăng nhập thì vào thẳng khu quản lý, khỏi phải bấm thêm lần nữa.
  if (await getInsuranceProviderSession()) redirect(ROUTES.baoHiemDoiTacDashboard);

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#f6f7f9] px-4 py-12">
      <div className="w-full max-w-[420px]">
        <InsuranceLoginForm />
      </div>
    </div>
  );
}
