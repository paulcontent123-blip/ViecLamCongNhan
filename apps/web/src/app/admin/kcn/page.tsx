import { getKcnList } from "@/lib/kcn";
import { KcnManagement } from "@/components/admin/KcnManagement";

export default async function AdminKcnPage() {
  const kcnList = await getKcnList();
  return <KcnManagement kcnList={kcnList} />;
}
