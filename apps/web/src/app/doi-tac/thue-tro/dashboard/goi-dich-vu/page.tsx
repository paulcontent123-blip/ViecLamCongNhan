import type { Metadata } from "next";
import { RentalOrders } from "@/components/doitac/RentalPortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireRentalProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Gói và đơn hàng | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function ThueTroDoiTacOrdersPage() {
  const session = await requireRentalProviderPage();

  return (
    <PortalChrome portal="rental" active="orders" providerName={session.providerName || session.email}>
      <RentalOrders />
    </PortalChrome>
  );
}
