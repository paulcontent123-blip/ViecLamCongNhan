import type { Metadata } from "next";
import { FinanceBooked } from "@/components/doitac/FinancePortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireFinanceProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Dịch vụ đã đặt | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function TaiChinhDoiTacBookedPage() {
  const session = await requireFinanceProviderPage();

  return (
    <PortalChrome portal="finance" active="booked" providerName={session.providerName || session.email}>
      <FinanceBooked />
    </PortalChrome>
  );
}
