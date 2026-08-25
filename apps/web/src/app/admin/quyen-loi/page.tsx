import { getAdminRightCards } from "@/lib/admin";
import { RightCardManagement } from "@/components/admin/RightCardManagement";

export default async function AdminRightsPage() {
  const cards = await getAdminRightCards();
  return <RightCardManagement cards={cards} />;
}
