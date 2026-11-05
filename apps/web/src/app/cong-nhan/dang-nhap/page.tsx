import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CandidateAuthForm } from "@/components/congnhan/CandidateAuthForms";
import { getCandidatePageSession } from "@/lib/candidate-account-page";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Đăng nhập công nhân | ViecLamCongNhan.com",
  description: "Đăng nhập hoặc tạo tài khoản công nhân để quản lý hồ sơ và theo dõi đơn ứng tuyển.",
};

export const dynamic = "force-dynamic";

export default async function CongNhanLoginPage() {
  // Đã đăng nhập thì vào thẳng tài khoản, khỏi phải bấm thêm lần nữa.
  if (await getCandidatePageSession()) redirect(ROUTES.congNhanAccount);

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#f6f7f9] px-4 py-12">
      <div className="w-full max-w-[420px]">
        <CandidateAuthForm />
      </div>
    </div>
  );
}
