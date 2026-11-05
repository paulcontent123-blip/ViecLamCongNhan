import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RentalLoginForm } from "@/components/doitac/RentalPortal";
import { getRentalProviderSession } from "@/lib/rental-provider-auth";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Đăng nhập chủ trọ | ViecLamCongNhan.com",
  description: "Đăng nhập cổng đối tác thuê trọ của ViecLamCongNhan.com.",
};

export const dynamic = "force-dynamic";

export default async function ThueTroDoiTacLoginPage() {
  // Đã đăng nhập thì vào thẳng khu quản lý, khỏi phải bấm thêm lần nữa.
  if (await getRentalProviderSession()) redirect(ROUTES.thueTroDoiTacDashboard);

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#f6f7f9] px-4 py-12">
      <div className="w-full max-w-[420px]">
        <RentalLoginForm />
      </div>
    </div>
  );
}
