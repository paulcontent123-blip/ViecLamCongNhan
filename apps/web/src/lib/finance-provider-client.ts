// Lớp gọi API cho cổng Đơn vị tài chính trên web.
//
// Dùng đúng các route app đang dùng, KHÔNG thêm hay sửa route nào:
//  - `api/finance-providers` (đăng ký) và `api/auth/finance-provider/*` (đăng nhập, đăng xuất)
//  - `api/mobile/finance-provider/*` (hồ sơ, logo, hồ sơ giấy phép, sản phẩm, yêu cầu, gói & đơn hàng, dịch vụ đã đặt)
//
// Như Bảo hiểm: lưu sản phẩm thì đơn vị đã xác minh tự vào "Chờ duyệt", chưa xác minh vào "Nháp". Khác Bảo hiểm:
// có route lưu trữ sản phẩm, đòi mốc phiên bản `expectedUpdatedAt` để hai thiết bị không ghi đè lên nhau.

import { MobileApiError } from "@/lib/mobile-session-client";
import { createProviderApi } from "@/lib/provider-shared-client";

export const financeApi = createProviderApi({
  slug: "finance-provider",
  sessionLabel: "đơn vị tài chính",
  registerPath: "finance-providers",
  noun: "đơn vị tài chính",
});

export const { register, login, logout, uploadLogo, listBooked, getProfile, saveProfile, listInquiries, updateInquiryStatus, openInquiryContact } = financeApi;

export type ProductRow = Record<string, unknown> & { id: string; title: string; status: string };

export const listProducts = (params: { status?: string; q?: string; page?: number; pageSize?: number }) =>
  financeApi.listResource<ProductRow>("products", { ...params });

export const createProduct = (body: Record<string, unknown>) =>
  financeApi.createItem("products", "product", body, "Chưa xác định sản phẩm đã gửi hay chưa. Tải lại danh sách trước khi gửi lại.");

export const updateProduct = (id: string, body: Record<string, unknown>) =>
  financeApi.updateItem("products", "product", id, body, "Chưa xác định cập nhật đã được lưu hay chưa. Tải lại danh sách trước khi thao tác lại.");

/**
 * Lưu trữ (ẩn) một sản phẩm. Máy chủ đòi `expectedUpdatedAt` đúng bằng mốc của bản ghi lúc tải danh sách; lệch thì
 * trả 409 "Sản phẩm vừa thay đổi" thay vì ẩn nhầm bản mới. Sản phẩm đã lưu trữ rồi vẫn trả `ok` (an toàn khi lặp).
 */
export async function archiveProduct(id: string, expectedUpdatedAt: string) {
  const data = await financeApi.portal.delete<{ archived?: unknown; id?: unknown }>(
    `${financeApi.P}/products/${encodeURIComponent(id)}`,
    {
      body: { expectedUpdatedAt },
      uncertainMessage: "Chưa xác định được sản phẩm đã lưu trữ hay chưa. Tải lại danh sách trước khi thử lại.",
    },
  );
  if (data.archived !== true || data.id !== id) {
    throw new MobileApiError("Chưa xác nhận được sản phẩm đã lưu trữ. Tải lại danh sách để kiểm tra.", 0, "UNCERTAIN");
  }
}

/**
 * Tải hồ sơ giấy phép (PDF, JPG, PNG, WEBP, tối đa 10MB) lên kho riêng. Máy chủ ghi tham chiếu `private-storage:…`
 * vào hồ sơ và có thể làm MẤT xác minh (`isVerified` trong phản hồi) vì giấy phép đã đổi. Dùng fetch thẳng vì là multipart.
 */
export async function uploadLicenseEvidence(file: File): Promise<{ reference: string; isVerified: boolean }> {
  const form = new FormData();
  form.append("file", file);
  const uncertain = "Chưa xác nhận được hồ sơ giấy phép đã lưu. Tải lại hồ sơ trước khi thử lại.";
  let response: Response;
  try {
    response = await fetch(`/api/mobile/${financeApi.P}/license-evidence`, { method: "POST", body: form });
  } catch {
    throw new MobileApiError(uncertain, 0, "UNCERTAIN");
  }
  const data = (await response.json().catch(() => null)) as {
    ok?: unknown;
    licenseEvidenceUrl?: unknown;
    isVerified?: unknown;
    error?: unknown;
  } | null;
  if (!response.ok) {
    if (response.status >= 500) throw new MobileApiError(uncertain, response.status, "UNCERTAIN");
    throw new MobileApiError(
      typeof data?.error === "string" ? data.error : "Chưa tải được hồ sơ giấy phép.",
      response.status,
      "HTTP",
    );
  }
  if (data?.ok !== true || typeof data.licenseEvidenceUrl !== "string" || typeof data.isVerified !== "boolean") {
    throw new MobileApiError(uncertain, 0, "UNCERTAIN");
  }
  return { reference: data.licenseEvidenceUrl, isVerified: data.isVerified };
}
