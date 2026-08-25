import { KcnAdvertisingPage } from "@/components/quangcao/KcnAdvertisingPage";
import { getAdvertisingAudienceCount } from "@/lib/advertising";
import { getActiveKcnAdCards } from "@/lib/kcn-ads";
import { getActiveServicePartnerCards } from "@/lib/service-partners";
import { getActiveAdvertisingPricingCards } from "@/lib/ad-pricing";

export default async function QuangCaoHopTacPage() {
  const [cards, partnerCards, pricingCards, audienceCount] = await Promise.all([
    getActiveKcnAdCards(),
    getActiveServicePartnerCards(),
    getActiveAdvertisingPricingCards(),
    getAdvertisingAudienceCount(),
  ]);
  return <KcnAdvertisingPage cards={cards} partnerCards={partnerCards} pricingCards={pricingCards} audienceCount={audienceCount} />;
}
