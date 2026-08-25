import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getJobBySlug } from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";
import { JobDetailContent } from "@/components/timviec/JobDetailContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) return { title: "Không tìm thấy tin tuyển dụng — ViecLamCongNhan.com" };

  const companyName = job.employers?.company_name ?? "Nhà tuyển dụng ẩn danh";
  return {
    title: `${job.title} — ${companyName} | ViecLamCongNhan.com`,
    description: job.description.slice(0, 160),
  };
}

// Trang đầy đủ cho 1 tin tuyển dụng — mở khi vào thẳng URL (chia sẻ link,
// vào lại từ lịch sử trình duyệt, hoặc bot SEO). Khi bấm vào thẻ việc làm từ
// /tim-viec-lam, cùng URL này bị route @modal/(.)[slug] chặn lại và hiển thị
// dạng modal thay vì render trang này (xem app/tim-viec-lam/@modal).
export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) notFound();

  return (
    <div className="px-4 pb-20 pt-8 sm:px-8 lg:px-[52px]">
      <div className="mx-auto max-w-3xl">
        <Link href={ROUTES.timViecLam} className="text-[13px] font-semibold text-brand-navy/50 hover:text-brand-orange">
          ← Quay lại danh sách việc làm
        </Link>
        <div className="mt-4 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <JobDetailContent job={job} />
        </div>
      </div>
    </div>
  );
}
