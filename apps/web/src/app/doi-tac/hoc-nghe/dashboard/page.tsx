import type { Metadata } from "next";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { TrainingOverview } from "@/components/doitac/TrainingOverview";
import { requireTrainingProviderPage } from "@/lib/training-provider-page";

export const metadata: Metadata = { title: "Tổng quan đơn vị đào tạo | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function HocNgheDoiTacDashboardPage() {
  const session = await requireTrainingProviderPage();

  return (
    <PortalChrome active="dashboard" providerName={session.providerName || session.email}>
      <TrainingOverview />
    </PortalChrome>
  );
}
