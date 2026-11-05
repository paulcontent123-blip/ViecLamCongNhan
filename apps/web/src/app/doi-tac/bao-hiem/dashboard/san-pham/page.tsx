import type { Metadata } from "next";
import { InsuranceProducts } from "@/components/doitac/InsurancePortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { getProviderVerified, requireInsuranceProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Sản phẩm bảo hiểm | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function BaoHiemDoiTacProductsPage() {
  const session = await requireInsuranceProviderPage();
  const verified = await getProviderVerified("insurance_providers", session.providerId);

  return (
    <PortalChrome portal="insurance" active="products" providerName={session.providerName || session.email}>
      <InsuranceProducts verified={verified} />
    </PortalChrome>
  );
}
