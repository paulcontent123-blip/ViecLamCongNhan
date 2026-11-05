import type { Metadata } from "next";
import { HealthServices } from "@/components/doitac/HealthServices";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { getHealthProviderVerified, requireHealthProviderPage } from "@/lib/health-provider-page";

export const metadata: Metadata = { title: "Dịch vụ của tôi | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function YTeDoiTacServicesPage() {
  const session = await requireHealthProviderPage();
  const verified = await getHealthProviderVerified(session.providerId);

  return (
    <PortalChrome portal="health" active="services" providerName={session.providerName || session.email}>
      <HealthServices verified={verified} />
    </PortalChrome>
  );
}
