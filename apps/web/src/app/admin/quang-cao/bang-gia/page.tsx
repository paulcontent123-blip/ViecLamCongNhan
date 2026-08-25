import { AdvertisingPricingAdminNav } from "@/components/admin/AdvertisingPricingAdminNav";
import { AdvertisingPricingManagement } from "@/components/admin/AdvertisingPricingManagement";
import { getAdminAdvertisingPricingCards } from "@/lib/admin";

export default async function AdminAdPricingPage() {
  const cards = await getAdminAdvertisingPricingCards();
  return (
    <div>
      <AdvertisingPricingAdminNav active="manage" />
      <AdvertisingPricingManagement cards={cards} />
    </div>
  );
}
