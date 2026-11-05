import { requireAdminPage } from "@/lib/admin-auth";
import { CandidateDeletionRequests } from "@/components/admin/CandidateDeletionRequests";

export const dynamic = "force-dynamic";

export default async function AdminCandidateDeletionsPage() {
  await requireAdminPage("admin_users");

  return (
    <div>
      <h1 className="mb-1 text-[16px] font-extrabold text-brand-navy">🗑️ Yêu cầu xóa tài khoản</h1>
      <p className="mb-4 text-[13px] text-brand-navy/50">
        Người lao động gửi yêu cầu xóa tài khoản từ trang tài khoản của họ. Tài khoản chỉ bị xóa khi bạn xác nhận ở đây; hồ sơ,
        ảnh đại diện và đơn ứng tuyển sẽ bị xóa và không thể khôi phục.
      </p>
      <CandidateDeletionRequests />
    </div>
  );
}
