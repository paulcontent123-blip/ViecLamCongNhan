import type { Metadata } from "next";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { TrainingOrders } from "@/components/doitac/TrainingOrders";
import { requireTrainingProviderPage } from "@/lib/training-provider-page";

export const metadata: Metadata = { title: "Gói & đơn hàng | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function HocNgheDoiTacOrdersPage() {
  const session = await requireTrainingProviderPage();

  return (
    <PortalChrome active="orders" providerName={session.providerName || session.email}>
      <TrainingOrders />
    </PortalChrome>
  );
}
