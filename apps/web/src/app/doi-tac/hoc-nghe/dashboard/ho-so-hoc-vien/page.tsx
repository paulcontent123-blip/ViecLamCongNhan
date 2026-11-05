import type { Metadata } from "next";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { TrainingLeads } from "@/components/doitac/TrainingLeads";
import { requireTrainingProviderPage } from "@/lib/training-provider-page";

export const metadata: Metadata = { title: "Hồ sơ học viên | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function HocNgheDoiTacApplicationsPage() {
  const session = await requireTrainingProviderPage();

  return (
    <PortalChrome active="applications" providerName={session.providerName || session.email}>
      <TrainingLeads kind="applications" />
    </PortalChrome>
  );
}
