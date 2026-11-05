import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getHealthProviderSession } from "@/lib/health-provider-auth";
import { HealthLoginForm } from "@/components/doitac/HealthAuthForms";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Đăng nhập cơ sở y tế | ViecLamCongNhan.com",
  description: "Đăng nhập cổng đối tác y tế của ViecLamCongNhan.com.",
};

export const dynamic = "force-dynamic";

export default async function YTeDoiTacLoginPage() {
  // Đã đăng nhập thì vào thẳng khu quản lý, khỏi phải bấm thêm lần nữa.
  if (await getHealthProviderSession()) redirect(ROUTES.yTeDoiTacDashboard);

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#f6f7f9] px-4 py-12">
      <div className="w-full max-w-[420px]">
        <HealthLoginForm />
      </div>
    </div>
  );
}
