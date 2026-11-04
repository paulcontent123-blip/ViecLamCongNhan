import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { PartnerProviderManagement } from "@/components/admin/PartnerProviderManagement";
import { ROUTES } from "@/lib/routes";

// Danh sách đọc ở trình duyệt qua api/mobile/admin/*, nên trang không cần dựng lại ở máy chủ.
export const dynamic = "force-dynamic";

export default async function AdminPartnersPage() {
  // Chặn thật nằm ở máy chủ (`requireAdmin("partners")` trong từng route); đây chỉ để Biên tập
  // không mở được trang rồi gặp lỗi 403 ở mọi thao tác.
  await requireAdminPage("partners");

  return (
    <div>
      <h1 className="mb-1 text-[16px] font-extrabold text-brand-navy">🤝 Đối tác dịch vụ</h1>
      <p className="mb-4 text-[13px] text-brand-navy/50">
        Xác minh năm loại đối tác và cấp hạn mức xem liên hệ. Đối tác chưa xác minh thì nội dung họ đăng
        không duyệt được và không hiển thị cho công nhân.{" "}
        <Link href={ROUTES.adminPartnerContent} className="font-semibold text-brand-orange">
          Sang mục duyệt nội dung →
        </Link>
      </p>
      <PartnerProviderManagement />
    </div>
  );
}
