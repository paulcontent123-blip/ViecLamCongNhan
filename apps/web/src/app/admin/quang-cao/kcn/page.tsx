import { getAdminKcnAdCards } from "@/lib/admin";
import { KcnAdCardManagement } from "@/components/admin/KcnAdCardManagement";
import { KcnAdvertisingAdminNav } from "@/components/admin/KcnAdvertisingAdminNav";

export default async function AdminKcnAdsPage() {
  const cards = await getAdminKcnAdCards();
  return (
    <div>
      <KcnAdvertisingAdminNav active="manage" />
      <KcnAdCardManagement cards={cards} />
    </div>
  );
}
