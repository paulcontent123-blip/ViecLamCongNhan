import type { Metadata } from "next";
import { InsuranceList } from "@/components/dichvucongnhan/InsuranceList";
import { ServiceContainer, ServiceHero, ServiceTabs } from "@/components/dichvucongnhan/ui";
import { WORKER_SERVICES } from "@/lib/worker-services";

const service = WORKER_SERVICES["bao-hiem"];

export const metadata: Metadata = {
  title: "Bảo hiểm cho công nhân | ViecLamCongNhan.com",
  description: service.description,
};

export default function BaoHiemPage() {
  return (
    <>
      <ServiceHero service={service} />
      <ServiceTabs active={service.key} />
      <ServiceContainer>
        <InsuranceList />
      </ServiceContainer>
    </>
  );
}
