import type { Metadata } from "next";
import { VocationalList } from "@/components/dichvucongnhan/VocationalList";
import { ServiceContainer, ServiceHero, ServiceTabs } from "@/components/dichvucongnhan/ui";
import { WORKER_SERVICES } from "@/lib/worker-services";

const service = WORKER_SERVICES["hoc-nghe"];

export const metadata: Metadata = {
  title: "Học nghề cho công nhân | ViecLamCongNhan.com",
  description: service.description,
};

export default function HocNghePage() {
  return (
    <>
      <ServiceHero service={service} />
      <ServiceTabs active={service.key} />
      <ServiceContainer>
        <VocationalList />
      </ServiceContainer>
    </>
  );
}
