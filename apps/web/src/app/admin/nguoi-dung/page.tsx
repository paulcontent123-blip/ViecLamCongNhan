import { requireAdminPage } from "@/lib/admin-auth";
import { getAdminUsers } from "@/lib/admin";
import { UserManagement } from "@/components/admin/UserManagement";

export default async function AdminUsersPage() {
  const session = await requireAdminPage("admin_users");
  const users = await getAdminUsers();
  return <UserManagement users={users} currentAdminId={session.userId} />;
}
