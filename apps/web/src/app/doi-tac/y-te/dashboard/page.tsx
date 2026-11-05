import type { Metadata } from "next";
import { HealthOverview } from "@/components/doitac/HealthOverview";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireHealthProviderPage } from "@/lib/health-provider-page";

export const metadata: Metadata = { title: "Tổng quan cơ sở y tế | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function YTeDoiTacDashboardPage() {
  const session = await requireHealthProviderPage();

  return (
    <PortalChrome portal="health" active="dashboard" providerName={session.providerName || session.email}>
      <HealthOverview />
    </PortalChrome>
  );
}
