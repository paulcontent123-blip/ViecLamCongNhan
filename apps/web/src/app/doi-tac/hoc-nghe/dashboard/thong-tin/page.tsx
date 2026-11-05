import type { Metadata } from "next";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { TrainingProfile } from "@/components/doitac/TrainingProfile";
import { requireTrainingProviderPage } from "@/lib/training-provider-page";

export const metadata: Metadata = { title: "Thông tin đơn vị đào tạo | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function HocNgheDoiTacProfilePage() {
  const session = await requireTrainingProviderPage();

  return (
    <PortalChrome active="profile" providerName={session.providerName || session.email}>
      <TrainingProfile />
    </PortalChrome>
  );
}
