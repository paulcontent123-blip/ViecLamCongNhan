import type { Metadata } from "next";
import { RentalTenants } from "@/components/doitac/RentalPortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireRentalProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Kho người thuê | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function ThueTroDoiTacTenantsPage() {
  const session = await requireRentalProviderPage();

  return (
    <PortalChrome portal="rental" active="tenants" providerName={session.providerName || session.email}>
      <RentalTenants />
    </PortalChrome>
  );
}
