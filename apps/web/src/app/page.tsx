import { Hero } from "@/components/home/Hero";
import { KcnFilterBar } from "@/components/home/KcnFilterBar";
import { StatsBar } from "@/components/home/StatsBar";
import { FeaturedJobs } from "@/components/home/FeaturedJobs";
import { CampaignShowcase } from "@/components/home/CampaignShowcase";
import { ValueProps } from "@/components/home/ValueProps";
import { getHomeStats } from "@/lib/home-stats";
import { getKcnList } from "@/lib/kcn";

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
  const [stats, kcnList] = await Promise.all([getHomeStats(), getKcnList()]);
  const selectedKcn = kcnList.find((kcn) => kcn.id === requestedKcnId);

  return (
    <>
      <Hero stats={stats} />
      <KcnFilterBar kcnList={kcnList} selectedId={selectedKcn?.id} />
      <StatsBar stats={stats} />
      <FeaturedJobs selectedKcnId={selectedKcn?.id} selectedKcnName={selectedKcn?.name} />
      <CampaignShowcase candidatesCount={stats.candidates} />
      <ValueProps stats={stats} />
    </>
  );
}
