import { ServiceInquiryPage } from "@/components/dichvu/ServiceInquiryPage";
import { getActiveServicePackageCards } from "@/lib/service-packages";

export default async function DichVuTronGoiPage() {
  const cards = await getActiveServicePackageCards();
  return <ServiceInquiryPage cards={cards} />;
}
