import { getAdminSession } from "@/lib/admin-auth";
import { getAdminUsers } from "@/lib/admin";
import { UserManagement } from "@/components/admin/UserManagement";

export default async function AdminUsersPage() {
  const [users, session] = await Promise.all([getAdminUsers(), getAdminSession()]);
  return <UserManagement users={users} currentAdminId={session?.userId ?? ""} />;
}
