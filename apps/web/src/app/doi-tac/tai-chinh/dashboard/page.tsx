import type { Metadata } from "next";
import { FinanceOverview } from "@/components/doitac/FinancePortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireFinanceProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Tổng quan đối tác tài chính | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function TaiChinhDoiTacDashboardPage() {
  const session = await requireFinanceProviderPage();

  return (
    <PortalChrome portal="finance" active="dashboard" providerName={session.providerName || session.email}>
      <FinanceOverview />
    </PortalChrome>
  );
}
