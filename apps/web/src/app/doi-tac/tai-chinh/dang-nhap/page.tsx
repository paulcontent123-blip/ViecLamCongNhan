import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FinanceLoginForm } from "@/components/doitac/FinancePortal";
import { getFinanceProviderSession } from "@/lib/finance-provider-auth";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Đăng nhập đối tác tài chính | ViecLamCongNhan.com",
  description: "Đăng nhập cổng đối tác tài chính của ViecLamCongNhan.com.",
};

export const dynamic = "force-dynamic";

export default async function TaiChinhDoiTacLoginPage() {
  // Đã đăng nhập thì vào thẳng khu quản lý, khỏi phải bấm thêm lần nữa.
  if (await getFinanceProviderSession()) redirect(ROUTES.taiChinhDoiTacDashboard);

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#f6f7f9] px-4 py-12">
      <div className="w-full max-w-[420px]">
        <FinanceLoginForm />
      </div>
    </div>
  );
}
