import type { Metadata } from "next";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { TrainingLearners } from "@/components/doitac/TrainingLearners";
import { requireTrainingProviderPage } from "@/lib/training-provider-page";

export const metadata: Metadata = { title: "Kho học viên | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function HocNgheDoiTacLearnersPage() {
  const session = await requireTrainingProviderPage();

  return (
    <PortalChrome active="learners" providerName={session.providerName || session.email}>
      <TrainingLearners />
    </PortalChrome>
  );
}
