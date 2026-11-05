import type { Metadata } from "next";
import { InsuranceProfile } from "@/components/doitac/InsurancePortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireInsuranceProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Hồ sơ đơn vị bảo hiểm | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function BaoHiemDoiTacProfilePage() {
  const session = await requireInsuranceProviderPage();

  return (
    <PortalChrome portal="insurance" active="profile" providerName={session.providerName || session.email}>
      <InsuranceProfile />
    </PortalChrome>
  );
}
