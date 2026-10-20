import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCampaignBySlug } from "@/lib/jobs";
import { ROUTES } from "@/lib/routes";
import { CampaignDetailContent } from "@/components/timviec/CampaignDetailContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = await getCampaignBySlug(slug);
  if (!job) return { title: "Không tìm thấy chiến dịch | ViecLamCongNhan.com" };

  return {
    title: `${job.title} | ViecLamCongNhan.com`,
    description: (job.campaign_story || job.description).slice(0, 160),
  };
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = await getCampaignBySlug(slug);
  if (!job) notFound();

  return (
    <div className="px-4 pb-20 pt-8 sm:px-8 lg:px-[52px]">
      <div className="mx-auto max-w-3xl">
        <Link href={ROUTES.home} className="text-[13px] font-semibold text-brand-navy/50 hover:text-brand-orange">
          ← Chiến dịch tuyển dụng
        </Link>
        <div className="mt-4 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <CampaignDetailContent job={job} />
        </div>
      </div>
    </div>
  );
}
