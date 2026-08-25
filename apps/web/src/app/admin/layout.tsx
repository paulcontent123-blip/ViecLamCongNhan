import { getAdminSession } from "@/lib/admin-auth";
import { getAdminSidebarCounts } from "@/lib/admin";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { LogoutButton } from "@/components/admin/LogoutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  // Chưa đăng nhập: đây chính là /admin/login (middleware đã chặn mọi trang admin
  // khác) — hiện form login trần, không có khung sidebar/topbar quản trị.
  if (!session) {
    return <>{children}</>;
  }

  const counts = await getAdminSidebarCounts();

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className="flex items-center justify-between bg-brand-navy px-4 py-3 sm:px-6">
        <div className="text-[14.5px] font-extrabold text-white">
          ViecLam<em className="not-italic text-brand-orange">CongNhan</em>
          <span className="ml-2 font-medium text-white/40">— Quản trị</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[12.5px] font-semibold text-white/70 sm:inline">{session.fullName}</span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-brand-orange">
            Admin
          </span>
          <LogoutButton />
        </div>
      </div>

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-[220px_1fr]">
        <AdminSidebar counts={counts} />
        <main className="min-w-0 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
