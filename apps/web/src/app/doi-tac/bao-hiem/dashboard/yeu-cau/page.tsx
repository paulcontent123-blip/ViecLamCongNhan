import type { Metadata } from "next";
import { InsuranceInquiries } from "@/components/doitac/InsurancePortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireInsuranceProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Yêu cầu tư vấn | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function BaoHiemDoiTacInquiriesPage() {
  const session = await requireInsuranceProviderPage();

  return (
    <PortalChrome portal="insurance" active="inquiries" providerName={session.providerName || session.email}>
      <InsuranceInquiries />
    </PortalChrome>
  );
}
