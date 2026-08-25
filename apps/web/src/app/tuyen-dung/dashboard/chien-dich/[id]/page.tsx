import Link from "next/link";
import { notFound } from "next/navigation";
import { getEmployerSession } from "@/lib/employer-auth";
import { getEmployerCampaignById } from "@/lib/employer";
import { isCampaignTheme } from "@/lib/campaign-theme";
import { ROUTES } from "@/lib/routes";
import { CampaignEditForm } from "@/components/ntd/CampaignEditForm";

export default async function EmployerCampaignEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getEmployerSession();
  if (!session) return null;

  const { id } = await params;
  const campaign = await getEmployerCampaignById(session.employerId, id);
  if (!campaign) notFound();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={ROUTES.ntdDashboardCampaigns} className="text-[12.5px] font-bold text-brand-orange">
            ← Chiến dịch của tôi
          </Link>
          <h2 className="mt-1 text-[15px] font-extrabold text-brand-navy">{campaign.title}</h2>
          <div className="mt-1 text-[12.5px] font-semibold text-brand-orange">
            📩 Đã gửi: {campaign.blast_sent_count.toLocaleString("vi-VN")} ứng viên
          </div>
        </div>
        {campaign.status === "approved" && (
          <a
            href={`${ROUTES.chienDich}/${campaign.slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-black/10 px-3.5 py-2.5 text-[12.5px] font-bold text-brand-navy/65 transition hover:border-brand-orange hover:text-brand-orange"
          >
            👁 Xem trang công khai →
          </a>
        )}
      </div>

      <CampaignEditForm
        campaignId={campaign.id}
        initialTheme={isCampaignTheme(campaign.campaign_theme) ? campaign.campaign_theme : "orange"}
        initialStory={campaign.campaign_story ?? ""}
        initial={{
          title: campaign.title,
          description: campaign.description,
          requirements: campaign.requirements ?? "",
          salaryMin: campaign.salary_min?.toString() ?? "",
          salaryMax: campaign.salary_max?.toString() ?? "",
          jobType: campaign.job_type ?? "",
          provinceCode: campaign.province_code,
          district: campaign.district ?? "",
          industry: campaign.industry,
          quantity: campaign.quantity.toString(),
          shiftType: campaign.shift_type ?? "",
          isUrgent: campaign.is_urgent,
          hasHousing: campaign.has_housing,
          hasShuttle: campaign.has_shuttle,
          hasMeals: campaign.has_meals,
          noExperienceRequired: campaign.no_experience_required,
        }}
      />
    </div>
  );
}
