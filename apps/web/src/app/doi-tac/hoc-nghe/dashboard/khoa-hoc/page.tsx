import type { Metadata } from "next";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { TrainingCourses } from "@/components/doitac/TrainingCourses";
import { getTrainingProviderVerified, requireTrainingProviderPage } from "@/lib/training-provider-page";

export const metadata: Metadata = { title: "Khóa học của tôi | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function HocNgheDoiTacCoursesPage() {
  const session = await requireTrainingProviderPage();
  const verified = await getTrainingProviderVerified(session.providerId);

  return (
    <PortalChrome active="courses" providerName={session.providerName || session.email}>
      <TrainingCourses verified={verified} />
    </PortalChrome>
  );
}
