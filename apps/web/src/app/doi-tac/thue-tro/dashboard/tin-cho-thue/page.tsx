import type { Metadata } from "next";
import { RentalListings } from "@/components/doitac/RentalListings";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { getProviderVerified, requireRentalProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Tin cho thuê | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function ThueTroDoiTacListingsPage() {
  const session = await requireRentalProviderPage();
  const verified = await getProviderVerified("rental_providers", session.providerId);

  return (
    <PortalChrome portal="rental" active="listings" providerName={session.providerName || session.email}>
      <RentalListings verified={verified} />
    </PortalChrome>
  );
}
