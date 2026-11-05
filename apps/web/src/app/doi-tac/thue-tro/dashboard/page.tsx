import type { Metadata } from "next";
import { RentalOverview } from "@/components/doitac/RentalPortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireRentalProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Tổng quan chủ trọ | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function ThueTroDoiTacDashboardPage() {
  const session = await requireRentalProviderPage();

  return (
    <PortalChrome portal="rental" active="dashboard" providerName={session.providerName || session.email}>
      <RentalOverview />
    </PortalChrome>
  );
}
