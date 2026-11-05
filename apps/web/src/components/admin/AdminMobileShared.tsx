"use client";

// Phần dùng chung cho các màn Quản trị đọc dữ liệu qua `api/mobile/admin/*`.
//
// Khác các trang Quản trị cũ (dựng ở máy chủ rồi `router.refresh()` sau mỗi thao tác): những route này
// chưa có hàm đọc trong `lib/`, nên trang chạy ở trình duyệt và tự tải lại danh sách sau khi ghi. Nhờ đó
// web dùng đúng API mà app Admin đang dùng, không phải thêm gì ở máy chủ.

import { adminList, type AdminQuery } from "@/lib/mobile-admin-client";
import {
  useMobileAction,
  useMobileList,
  type MobileAction,
  type MobileList,
} from "@/components/shared/useMobileList";

export type AdminMobileList<T> = MobileList<T>;
export type AdminAction = MobileAction;

/** Đọc một danh sách quản trị. Phần trạng thái dùng chung với cổng đối tác qua `useMobileList`. */
export function useAdminMobileList<T>(path: string, filters: AdminQuery, pageSize = 20): AdminMobileList<T> {
  return useMobileList<T>((params) => adminList<T>(path, params), filters, { pageSize });
}

export const useAdminAction = useMobileAction;

// ───────── Mảnh giao diện dùng chung ─────────
// Giữ tên cũ cho 4 màn Quản trị đang dùng; phần hiển thị thực sự nằm ở shared/mobileUi.
export {
  MobileTabs as AdminTabs,
  MobileFilterChips as AdminFilterChips,
  MobileSearch as AdminSearch,
  MobileStateCard as AdminStateCard,
  MobileActionAlert as AdminActionAlert,
  MobilePager as AdminPager,
} from "@/components/shared/mobileUi";
