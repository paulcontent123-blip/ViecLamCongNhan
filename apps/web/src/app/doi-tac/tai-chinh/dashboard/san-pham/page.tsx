import type { Metadata } from "next";
import { FinanceProducts } from "@/components/doitac/FinancePortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { getProviderVerified, requireFinanceProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Sản phẩm tài chính | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function TaiChinhDoiTacProductsPage() {
  const session = await requireFinanceProviderPage();
  const verified = await getProviderVerified("finance_providers", session.providerId);

  return (
    <PortalChrome portal="finance" active="products" providerName={session.providerName || session.email}>
      <FinanceProducts verified={verified} />
    </PortalChrome>
  );
}
