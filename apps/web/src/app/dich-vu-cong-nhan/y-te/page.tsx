import type { Metadata } from "next";
import { HealthList } from "@/components/dichvucongnhan/HealthList";
import { ServiceContainer, ServiceHero, ServiceTabs } from "@/components/dichvucongnhan/ui";
import { WORKER_SERVICES } from "@/lib/worker-services";

const service = WORKER_SERVICES["y-te"];

export const metadata: Metadata = {
  title: "Y tế & sức khỏe cho công nhân | ViecLamCongNhan.com",
  description: service.description,
};

export default function YTePage() {
  return (
    <>
      <ServiceHero service={service} />
      <ServiceTabs active={service.key} />
      <ServiceContainer>
        <HealthList />
      </ServiceContainer>
    </>
  );
}
