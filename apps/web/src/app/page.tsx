import { Hero } from "@/components/home/Hero";
import { KcnFilterBar } from "@/components/home/KcnFilterBar";
import { StatsBar } from "@/components/home/StatsBar";
import { FeaturedJobs } from "@/components/home/FeaturedJobs";
import { CampaignShowcase } from "@/components/home/CampaignShowcase";
import { ValueProps } from "@/components/home/ValueProps";
import { getHomeStats } from "@/lib/home-stats";
import { getKcnList } from "@/lib/kcn";
import { getRunningAds } from "@/lib/ads-queries";
import { AdBanner } from "@/components/ads/AdSlots";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawSearchParams = await searchParams;
  const requestedKcnId = firstParam(rawSearchParams.kcnId);
  const [stats, kcnList, [banner]] = await Promise.all([getHomeStats(), getKcnList(), getRunningAds({ placement: "homepage_banner", channel: "web" })]);
  const selectedKcn = kcnList.find((kcn) => kcn.id === requestedKcnId);

  return (
    <>
      <Hero stats={stats} />
      {banner && (
        <div className="px-4 pt-6 sm:px-8 lg:px-[52px]">
          <div className="mx-auto max-w-6xl">
            <AdBanner ad={banner} />
          </div>
        </div>
      )}
      <KcnFilterBar kcnList={kcnList} selectedId={selectedKcn?.id} />
      <StatsBar stats={stats} />
      <FeaturedJobs selectedKcnId={selectedKcn?.id} selectedKcnName={selectedKcn?.name} />
      <CampaignShowcase candidatesCount={stats.candidates} />
      <ValueProps stats={stats} />
    </>
  );
}
