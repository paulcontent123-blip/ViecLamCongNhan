import type { Metadata } from "next";
import { FinanceProfile } from "@/components/doitac/FinancePortal";
import { PortalChrome } from "@/components/doitac/PortalChrome";
import { requireFinanceProviderPage } from "@/lib/provider-page";

export const metadata: Metadata = { title: "Hồ sơ đơn vị tài chính | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function TaiChinhDoiTacProfilePage() {
  const session = await requireFinanceProviderPage();

  return (
    <PortalChrome portal="finance" active="profile" providerName={session.providerName || session.email}>
      <FinanceProfile />
    </PortalChrome>
  );
}
