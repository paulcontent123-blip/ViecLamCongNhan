import { getAdminServicePackageCards } from "@/lib/admin";
import { ServicePackageAdminNav } from "@/components/admin/ServicePackageAdminNav";
import { ServicePackageManagement } from "@/components/admin/ServicePackageManagement";

export default async function AdminServicePackagesPage() {
  const cards = await getAdminServicePackageCards();
  return (
    <div>
      <ServicePackageAdminNav active="manage" />
      <ServicePackageManagement cards={cards} />
    </div>
  );
}
