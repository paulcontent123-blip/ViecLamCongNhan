import type { Metadata } from "next";
import { RentalProfile } from "@/components/doitac/RentalPortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireRentalProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Hồ sơ chủ trọ | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function ThueTroDoiTacProfilePage() {
  const session = await requireRentalProviderPage();

  return (
    <PortalChrome portal="rental" active="profile" providerName={session.providerName || session.email}>
      <RentalProfile />
    </PortalChrome>
  );
}
