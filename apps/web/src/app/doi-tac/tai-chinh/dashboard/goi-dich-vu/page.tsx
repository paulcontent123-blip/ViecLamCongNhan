import type { Metadata } from "next";
import { FinanceOrders } from "@/components/doitac/FinancePortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireFinanceProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Gói và hạn mức | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function TaiChinhDoiTacOrdersPage() {
  const session = await requireFinanceProviderPage();

  return (
    <PortalChrome portal="finance" active="orders" providerName={session.providerName || session.email}>
      <FinanceOrders />
    </PortalChrome>
  );
}
