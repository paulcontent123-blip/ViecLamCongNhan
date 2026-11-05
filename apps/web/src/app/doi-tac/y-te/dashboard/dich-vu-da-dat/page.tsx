import type { Metadata } from "next";
import { HealthBooked } from "@/components/doitac/HealthBooked";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireHealthProviderPage } from "@/lib/health-provider-page";

export const metadata: Metadata = { title: "Dịch vụ đã đặt | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function YTeDoiTacBookedPage() {
  const session = await requireHealthProviderPage();

  return (
    <PortalChrome portal="health" active="booked" providerName={session.providerName || session.email}>
      <HealthBooked />
    </PortalChrome>
  );
}
