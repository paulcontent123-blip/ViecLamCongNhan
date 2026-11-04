import type { Metadata } from "next";
import { FinanceList } from "@/components/dichvucongnhan/FinanceList";
import { ServiceContainer, ServiceHero, ServiceTabs } from "@/components/dichvucongnhan/ui";
import { WORKER_SERVICES } from "@/lib/worker-services";

const service = WORKER_SERVICES["tai-chinh"];

export const metadata: Metadata = {
  title: "Tài chính cho công nhân | ViecLamCongNhan.com",
  description: service.description,
};

export default function TaiChinhPage() {
  return (
    <>
      <ServiceHero service={service} />
      <ServiceTabs active={service.key} />
      <ServiceContainer>
        <FinanceList />
      </ServiceContainer>
    </>
  );
}
