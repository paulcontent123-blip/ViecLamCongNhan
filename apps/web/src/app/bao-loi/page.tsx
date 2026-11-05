import type { Metadata } from "next";
import { BugReportForm } from "@/components/baoloi/BugReportForm";

export const metadata: Metadata = {
  title: "Báo lỗi website | ViecLamCongNhan.com",
  description: "Gửi báo lỗi khi bạn gặp sự cố trên ViecLamCongNhan.com để Admin kiểm tra và xử lý.",
};

export default async function BaoLoiPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;

  return (
    <div className="bg-[#f6f7f9] px-4 py-12 sm:px-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-5 text-center">
          <div className="text-[34px]" aria-hidden="true">
            🐞
          </div>
          <h1 className="mt-1 text-[22px] font-extrabold text-brand-navy">Báo lỗi website</h1>
          <p className="mt-1 text-[13px] text-brand-navy/55">
            Gặp sự cố khi dùng web? Mô tả giúp chúng tôi để Admin kiểm tra và xử lý.
          </p>
        </div>
        <BugReportForm from={from} />
      </div>
    </div>
  );
}
