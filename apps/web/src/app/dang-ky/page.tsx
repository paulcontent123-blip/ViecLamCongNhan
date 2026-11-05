import type { Metadata } from "next";
import { RegisterTabs } from "@/components/auth/RegisterTabs";

export const metadata: Metadata = {
  title: "Đăng ký | ViecLamCongNhan.com",
  description: "Đăng ký tài khoản người lao động, nhà tuyển dụng hoặc đối tác dịch vụ trên ViecLamCongNhan.com.",
};

export default async function DangKyPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;

  return (
    <div className="flex min-h-[70vh] items-start justify-center bg-[#f6f7f9] px-4 py-12">
      <RegisterTabs initialTab={tab === "doi-tac" ? "doi-tac" : "lao-dong"} />
    </div>
  );
}
