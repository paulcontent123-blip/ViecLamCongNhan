import type { Metadata } from "next";
import { HealthProfile } from "@/components/doitac/HealthProfile";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireHealthProviderPage } from "@/lib/health-provider-page";

export const metadata: Metadata = { title: "Hồ sơ cơ sở y tế | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function YTeDoiTacProfilePage() {
  const session = await requireHealthProviderPage();

  return (
    <PortalChrome portal="health" active="profile" providerName={session.providerName || session.email}>
      <HealthProfile />
    </PortalChrome>
  );
}
