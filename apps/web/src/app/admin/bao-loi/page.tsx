import { requireAdminPage } from "@/lib/admin-auth";
import { BugReportManagement } from "@/components/admin/BugReportManagement";

export const dynamic = "force-dynamic";

export default async function AdminBugReportsPage() {
  await requireAdminPage();

  return (
    <div>
      <h1 className="mb-1 text-[16px] font-extrabold text-brand-navy">🐞 Báo lỗi ứng dụng</h1>
      <p className="mb-4 text-[13px] text-brand-navy/50">
        Báo lỗi do công nhân và đối tác gửi từ trong app. Mỗi người gửi tối đa 5 báo lỗi trong 24 giờ, và
        gửi lại đúng nội dung trong 10 phút được gộp làm một.
      </p>
      <BugReportManagement />
    </div>
  );
}
