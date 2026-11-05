import type { Metadata } from "next";
import { InsuranceBooked } from "@/components/doitac/InsurancePortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireInsuranceProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Dịch vụ đã đặt | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function BaoHiemDoiTacBookedPage() {
  const session = await requireInsuranceProviderPage();

  return (
    <PortalChrome portal="insurance" active="booked" providerName={session.providerName || session.email}>
      <InsuranceBooked />
    </PortalChrome>
  );
}
