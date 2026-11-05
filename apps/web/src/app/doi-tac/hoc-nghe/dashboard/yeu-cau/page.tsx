import type { Metadata } from "next";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { TrainingLeads } from "@/components/doitac/TrainingLeads";
import { requireTrainingProviderPage } from "@/lib/training-provider-page";

export const metadata: Metadata = { title: "Yêu cầu học nghề | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function HocNgheDoiTacInquiriesPage() {
  const session = await requireTrainingProviderPage();

  return (
    <PortalChrome active="inquiries" providerName={session.providerName || session.email}>
      <TrainingLeads kind="inquiries" />
    </PortalChrome>
  );
}
