// Lớp gọi API cho cổng Chủ trọ trên web.
//
// Dùng đúng các route app đang dùng, KHÔNG thêm hay sửa route nào:
//  - `api/rental-providers` (đăng ký) và `api/auth/rental-provider/*` (đăng nhập, đăng xuất)
//  - `api/mobile/rental-provider/*` (hồ sơ, logo, tin cho thuê, ảnh, yêu cầu, Kho người thuê, gói & đơn hàng, dịch vụ đã đặt)
//
// BẢN SAO QUY TẮC GHI CỦA APP (`services/rentalProviderApi.js`, `RentalListingFormScreen.js`): thao tác ghi mà kết quả
// không rõ thì KHÔNG tự gửi lại; ảnh phải tải lên TỪNG ẢNH vào một tin đã tồn tại.

import { MobileApiError } from "@/lib/mobile-session-client";
import { createProviderApi } from "@/lib/provider-shared-client";

export const rentalApi = createProviderApi({
  slug: "rental-provider",
  sessionLabel: "chủ trọ",
  registerPath: "rental-providers",
  noun: "chủ trọ",
});

export const { register, login, logout, uploadLogo, listBooked, getProfile, saveProfile, listInquiries, updateInquiryStatus } = rentalApi;

/** Thuê trọ trả số lượt đã dùng trong khối `usage` của chính phản hồi; `openContact` của nhà máy đã gom về một dạng. */
export const openInquiryContact = rentalApi.openInquiryContact;

// ───────── Tin cho thuê ─────────

export type ListingRow = Record<string, unknown> & { id: string; title: string; status: string };

export const listListings = (params: { status?: string; q?: string; page?: number; pageSize?: number }) =>
  rentalApi.listResource<ListingRow>("listings", { ...params });

/** Tạo tin. Phản hồi chỉ có `id,title,status,created_at` (không có ảnh), nên tin mới luôn bắt đầu với 0 ảnh. */
export const createListing = (body: Record<string, unknown>) =>
  rentalApi.createItem("listings", "listing", body, "Chưa xác định tin đã gửi hay chưa. Tải lại danh sách trước khi gửi lại.");

export const updateListing = (id: string, body: Record<string, unknown>) =>
  rentalApi.updateItem("listings", "listing", id, body, "Chưa xác định cập nhật đã được lưu hay chưa. Tải lại danh sách trước khi thao tác lại.");

/** Đánh dấu hết phòng hoặc ẩn tin; chỉ gửi `status`, không đụng nội dung. */
export const setListingAvailability = (id: string, status: "full" | "hidden") => updateListing(id, { status });

/**
 * Tải MỘT ảnh lên tin. Máy chủ nhận JPG/PNG/WEBP tối đa 4MB, tối đa 12 ảnh mỗi tin, và kiểm tra nội dung tệp có đúng
 * định dạng. Trả về danh sách ảnh đầy đủ sau khi gắn. Dùng fetch thẳng vì là multipart.
 */
export async function uploadListingPhoto(listingId: string, file: File): Promise<string[]> {
  const form = new FormData();
  form.append("file", file);
  const uncertain = "Chưa xác định ảnh đã gắn vào tin hay chưa. Tải lại tin trước khi thử tiếp.";
  let response: Response;
  try {
    response = await fetch(`/api/mobile/${rentalApi.P}/listings/${encodeURIComponent(listingId)}/photos`, {
      method: "POST",
      body: form,
    });
  } catch {
    throw new MobileApiError(uncertain, 0, "UNCERTAIN");
  }
  const data = (await response.json().catch(() => null)) as { ok?: unknown; photoUrls?: unknown; error?: unknown } | null;
  if (!response.ok) {
    if (response.status >= 500) throw new MobileApiError(uncertain, response.status, "UNCERTAIN");
    throw new MobileApiError(typeof data?.error === "string" ? data.error : "Chưa tải được ảnh.", response.status, "HTTP");
  }
  if (data?.ok !== true || !Array.isArray(data.photoUrls)) throw new MobileApiError(uncertain, 0, "UNCERTAIN");
  return data.photoUrls.filter((url): url is string => typeof url === "string");
}

/**
 * Thay danh sách ảnh (xoá hoặc đổi thứ tự). Máy chủ đòi `expectedPhotoUrls` đúng bằng danh sách hiện có; lệch thì
 * từ chối thay vì ghi đè ảnh người khác vừa thêm.
 */
export async function updateListingPhotos(listingId: string, expectedPhotoUrls: string[], photoUrls: string[]): Promise<string[]> {
  const data = await rentalApi.portal.patch<{ photoUrls?: unknown }>(
    `${rentalApi.P}/listings/${encodeURIComponent(listingId)}/photos`,
    { expectedPhotoUrls, photoUrls },
    { uncertainMessage: "Chưa xác định danh sách ảnh đã lưu hay chưa. Tải lại tin trước khi thao tác lại." },
  );
  if (!Array.isArray(data.photoUrls)) {
    throw new MobileApiError("Chưa xác nhận được danh sách ảnh. Tải lại tin trước khi thao tác lại.", 0, "UNCERTAIN");
  }
  return data.photoUrls.filter((url): url is string => typeof url === "string");
}

// ───────── Kho người thuê ─────────

export type TenantRow = Record<string, unknown> & { id: string; full_name: string };

/** Khoá không được phép xuất hiện trong danh sách Kho người thuê ‑ app cũng kiểm tra đúng những khoá này. */
const CONTACT_KEYS = ["phone", "email", "zalo", "user_id"];

export async function listTenants(params: { q?: string; province?: string; page?: number; pageSize?: number }) {
  const result = await rentalApi.listResource<TenantRow>("tenants", { ...params });
  // Chặn rò rỉ: danh sách chỉ được chứa hồ sơ ẩn danh, liên hệ phải mở từng người theo hạn mức.
  if (result.items.some((item) => CONTACT_KEYS.some((key) => key in item))) {
    throw new MobileApiError("Phản hồi Kho người thuê chứa thông tin liên hệ không được phép hiển thị.", 0, "RESPONSE");
  }
  return result;
}

export const openTenantContact = (id: string) => rentalApi.openContact(`tenants/${encodeURIComponent(id)}/contact`);
