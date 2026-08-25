import { getAdminServicePartnerCards } from "@/lib/admin";
import { ServicePartnerAdminNav } from "@/components/admin/ServicePartnerAdminNav";
import { ServicePartnerManagement } from "@/components/admin/ServicePartnerManagement";

export default async function AdminPartnersPage() {
  const cards = await getAdminServicePartnerCards();
  return (
    <div>
      <ServicePartnerAdminNav active="manage" />
      <ServicePartnerManagement cards={cards} />
    </div>
  );
}
