import type { Metadata } from "next";
import { InsuranceOrders } from "@/components/doitac/InsurancePortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireInsuranceProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Gói và hạn mức | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function BaoHiemDoiTacOrdersPage() {
  const session = await requireInsuranceProviderPage();

  return (
    <PortalChrome portal="insurance" active="orders" providerName={session.providerName || session.email}>
      <InsuranceOrders />
    </PortalChrome>
  );
}
