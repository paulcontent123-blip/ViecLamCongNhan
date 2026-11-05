import type { Metadata } from "next";
import { FinanceInquiries } from "@/components/doitac/FinancePortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireFinanceProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Yêu cầu tư vấn | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function TaiChinhDoiTacInquiriesPage() {
  const session = await requireFinanceProviderPage();

  return (
    <PortalChrome portal="finance" active="inquiries" providerName={session.providerName || session.email}>
      <FinanceInquiries />
    </PortalChrome>
  );
}
