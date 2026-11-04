import type { Metadata } from "next";
import { RentalDetail } from "@/components/dichvucongnhan/RentalDetail";
import { ServiceContainer, ServiceHero, ServiceTabs } from "@/components/dichvucongnhan/ui";
import { WORKER_SERVICES } from "@/lib/worker-services";

const service = WORKER_SERVICES["thue-tro"];

// Tên tin chỉ có sau khi trình duyệt gọi `api/mobile/rentals/[id]`, nên tiêu đề tab là tên chung.
export const metadata: Metadata = {
  title: "Chi tiết tin cho thuê | ViecLamCongNhan.com",
  description: service.description,
};

export default async function ThueTroChiTietPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <ServiceHero service={service} />
      <ServiceTabs active={service.key} />
      <ServiceContainer>
        <RentalDetail listingId={id} />
      </ServiceContainer>
    </>
  );
}
