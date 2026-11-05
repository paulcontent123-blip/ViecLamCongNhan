import type { Metadata } from "next";
import { InsuranceOverview } from "@/components/doitac/InsurancePortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireInsuranceProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Tổng quan đối tác bảo hiểm | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function BaoHiemDoiTacDashboardPage() {
  const session = await requireInsuranceProviderPage();

  return (
    <PortalChrome portal="insurance" active="dashboard" providerName={session.providerName || session.email}>
      <InsuranceOverview />
    </PortalChrome>
  );
}
