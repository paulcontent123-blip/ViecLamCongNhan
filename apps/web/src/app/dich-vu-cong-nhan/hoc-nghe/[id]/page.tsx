import type { Metadata } from "next";
import { VocationalCourseDetail } from "@/components/dichvucongnhan/VocationalCourseDetail";
import { ServiceContainer, ServiceHero, ServiceTabs } from "@/components/dichvucongnhan/ui";
import { WORKER_SERVICES } from "@/lib/worker-services";

const service = WORKER_SERVICES["hoc-nghe"];

// Tên khóa học chỉ có sau khi trình duyệt gọi `api/mobile/vocational/courses/[id]`, nên tiêu đề tab là tên chung.
export const metadata: Metadata = {
  title: "Chi tiết khóa học nghề | ViecLamCongNhan.com",
  description: service.description,
};

export default async function HocNgheChiTietPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <ServiceHero service={service} />
      <ServiceTabs active={service.key} />
      <ServiceContainer>
        <VocationalCourseDetail courseId={id} />
      </ServiceContainer>
    </>
  );
}
