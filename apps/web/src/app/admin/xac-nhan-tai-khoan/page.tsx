import { requireAdminPage } from "@/lib/admin-auth";
import { CandidateAccountApproval } from "@/components/admin/CandidateAccountApproval";

export const dynamic = "force-dynamic";

export default async function AdminCandidateAccountsPage() {
  await requireAdminPage("admin_users");

  return (
    <div>
      <h1 className="mb-1 text-[16px] font-extrabold text-brand-navy">✅ Xác nhận tài khoản công nhân</h1>
      <p className="mb-4 text-[13px] text-brand-navy/50">
        Công nhân đăng ký bằng số điện thoại và mật khẩu. Trên web, họ chỉ đăng nhập được sau khi bạn xác nhận tài khoản ở đây.
        Xác nhận cũng cho phép họ bật chia sẻ hồ sơ cho đối tác.
      </p>
      <CandidateAccountApproval />
    </div>
  );
}
