import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { TrainingLoginForm } from "@/components/doitac/TrainingLoginForm";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Đăng nhập đơn vị đào tạo | ViecLamCongNhan.com",
  description: "Đăng nhập cổng đối tác học nghề của ViecLamCongNhan.com.",
};

export const dynamic = "force-dynamic";

export default async function HocNgheDoiTacLoginPage() {
  // Đã đăng nhập thì vào thẳng khu quản lý, khỏi phải bấm thêm lần nữa.
  if (await getTrainingProviderSession()) redirect(ROUTES.hocNgheDoiTacDashboard);

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#f6f7f9] px-4 py-12">
      <div className="w-full max-w-[420px]">
        <TrainingLoginForm />
      </div>
    </div>
  );
}
