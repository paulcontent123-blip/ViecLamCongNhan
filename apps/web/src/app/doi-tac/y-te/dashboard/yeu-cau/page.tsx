import type { Metadata } from "next";
import { HealthInquiries } from "@/components/doitac/HealthInquiries";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireHealthProviderPage } from "@/lib/health-provider-page";

export const metadata: Metadata = { title: "Yêu cầu liên hệ | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function YTeDoiTacInquiriesPage() {
  const session = await requireHealthProviderPage();

  return (
    <PortalChrome portal="health" active="inquiries" providerName={session.providerName || session.email}>
      <HealthInquiries />
    </PortalChrome>
  );
}
