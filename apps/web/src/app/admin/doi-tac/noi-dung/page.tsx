import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { PartnerContentManagement } from "@/components/admin/PartnerContentManagement";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function AdminPartnerContentPage() {
  await requireAdminPage("partners");

  return (
    <div>
      <h1 className="mb-1 text-[16px] font-extrabold text-brand-navy">✅ Duyệt nội dung đối tác</h1>
      <p className="mb-4 text-[13px] text-brand-navy/50">
        Khóa học nghề, tin cho thuê, sản phẩm bảo hiểm, sản phẩm tài chính và dịch vụ y tế. Chỉ nội dung
        đã duyệt của đối tác đã xác minh mới hiện trên web và app.{" "}
        <Link href={ROUTES.adminPartners} className="font-semibold text-brand-orange">
          Sang mục xác minh đối tác →
        </Link>
      </p>
      <PartnerContentManagement />
    </div>
  );
}
