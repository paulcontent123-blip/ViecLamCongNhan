import type { Metadata } from "next";
import { RentalInquiries } from "@/components/doitac/RentalPortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireRentalProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Yêu cầu thuê | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function ThueTroDoiTacInquiriesPage() {
  const session = await requireRentalProviderPage();

  return (
    <PortalChrome portal="rental" active="inquiries" providerName={session.providerName || session.email}>
      <RentalInquiries />
    </PortalChrome>
  );
}
