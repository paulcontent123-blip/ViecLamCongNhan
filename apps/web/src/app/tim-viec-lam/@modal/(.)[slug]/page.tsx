import { notFound } from "next/navigation";
import { getJobBySlug } from "@/lib/jobs";
import { JobDetailModal } from "@/components/timviec/JobDetailModal";

// Intercepting route: khi điều hướng tới /tim-viec-lam/[slug] bằng client-side
// navigation xuất phát từ trong /tim-viec-lam (bấm thẻ việc làm), Next.js render
// route này thay vì app/tim-viec-lam/[slug]/page.tsx ‑ danh sách vẫn còn phía
// sau, chi tiết hiện dạng modal đè lên. Vào thẳng URL bằng link ngoài hoặc F5
// thì route [slug] thường (trang đầy đủ) mới là route được chọn.
export default async function JobDetailInterceptedModal({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) notFound();

  return <JobDetailModal job={job} />;
}
