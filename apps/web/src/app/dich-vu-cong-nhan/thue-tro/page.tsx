import type { Metadata } from "next";
import { RentalList } from "@/components/dichvucongnhan/RentalList";
import { ServiceContainer, ServiceHero, ServiceTabs } from "@/components/dichvucongnhan/ui";
import { WORKER_SERVICES } from "@/lib/worker-services";

const service = WORKER_SERVICES["thue-tro"];

export const metadata: Metadata = {
  title: "Thuê trọ gần khu công nghiệp | ViecLamCongNhan.com",
  description: service.description,
};

export default function ThueTroPage() {
  return (
    <>
      <ServiceHero service={service} />
      <ServiceTabs active={service.key} />
      <ServiceContainer>
        <RentalList />
      </ServiceContainer>
    </>
  );
}
