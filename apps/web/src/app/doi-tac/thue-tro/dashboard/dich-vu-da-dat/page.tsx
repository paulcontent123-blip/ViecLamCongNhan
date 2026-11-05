import type { Metadata } from "next";
import { RentalBooked } from "@/components/doitac/RentalPortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireRentalProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Dịch vụ đã đặt | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function ThueTroDoiTacBookedPage() {
  const session = await requireRentalProviderPage();

  return (
    <PortalChrome portal="rental" active="booked" providerName={session.providerName || session.email}>
      <RentalBooked />
    </PortalChrome>
  );
}
