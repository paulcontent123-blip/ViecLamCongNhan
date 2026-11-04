import { requireAdminPage } from "@/lib/admin-auth";
import { MarketplaceModeration } from "@/components/admin/MarketplaceModeration";

export const dynamic = "force-dynamic";

export default async function AdminMarketplacePage() {
  // Biên tập cũng duyệt được tin Chợ (route chỉ đòi phiên Admin, không đòi quyền riêng).
  await requireAdminPage();

  return (
    <div>
      <h1 className="mb-1 text-[16px] font-extrabold text-brand-navy">🛒 Chợ đồ cũ</h1>
      <p className="mb-4 text-[13px] text-brand-navy/50">
        Tin rao của công nhân. Chỉ tin đã duyệt mới hiện trong app; Chợ không có trang công khai trên web.
        Số điện thoại người bán chỉ hiện ở đây cho Admin.
      </p>
      <MarketplaceModeration />
    </div>
  );
}
