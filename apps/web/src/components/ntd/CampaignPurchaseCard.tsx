import Link from "next/link";
import { ROUTES } from "@/lib/routes";

/** Chỉ điều hướng sang trang Đăng tin mới (kèm ?campaign=1 để tự tick sẵn checkbox
 * "Mua thêm gói Chiến dịch") — việc chọn tin/nhập nội dung tin nhắn Zalo + thanh
 * toán đã chuyển hết sang PostJobForm, nơi có đầy đủ ngữ cảnh 1 tin cụ thể. */
export function CampaignPurchaseCard() {
  return (
    <Link
      href={`${ROUTES.ntdDashboardPostJob}?campaign=1`}
      className="block w-full rounded-lg border border-brand-orange/30 bg-brand-orange-light py-2 text-center text-[12px] font-bold text-brand-orange transition hover:bg-brand-orange/15"
    >
      Đăng ký ngay
    </Link>
  );
}
