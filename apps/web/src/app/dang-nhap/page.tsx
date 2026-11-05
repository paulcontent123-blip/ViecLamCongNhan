import type { Metadata } from "next";
import { UnifiedLoginForm } from "@/components/auth/UnifiedLoginForm";

export const metadata: Metadata = {
  title: "Đăng nhập | ViecLamCongNhan.com",
  description: "Đăng nhập tài khoản người lao động, nhà tuyển dụng hoặc đối tác của ViecLamCongNhan.com.",
};

export default function DangNhapPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#f6f7f9] px-4 py-12">
      <div className="w-full max-w-[420px] rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="mb-5 text-center">
          <div className="text-[34px]" aria-hidden="true">
            🔑
          </div>
          <h1 className="mt-1 text-[19px] font-extrabold text-brand-navy">Đăng nhập</h1>
          <p className="mt-1 text-[12.5px] text-brand-navy/50">
            Nhập tài khoản và mật khẩu, hệ thống tự đưa bạn về đúng trang của mình.
          </p>
        </div>
        <UnifiedLoginForm />
      </div>
    </div>
  );
}
