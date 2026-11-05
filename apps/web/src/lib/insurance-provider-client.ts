// Lớp gọi API cho cổng Đơn vị bảo hiểm trên web.
//
// Dùng đúng các route app đang dùng, KHÔNG thêm hay sửa route nào:
//  - `api/insurance-providers` (đăng ký) và `api/auth/insurance-provider/*` (đăng nhập, đăng xuất)
//  - `api/mobile/insurance-provider/*` (hồ sơ, logo, sản phẩm, yêu cầu, gói & đơn hàng, dịch vụ đã đặt)
//
// Khác Y tế/Học nghề: máy chủ KHÔNG nhận công tắc "gửi duyệt". Lưu một sản phẩm thì đơn vị đã xác minh tự vào
// "Chờ duyệt", chưa xác minh thì vào "Nháp" (xem `products` và `products/[id]`). Và không có route ẩn/xoá sản phẩm.

import { createProviderApi } from "@/lib/provider-shared-client";

export const insuranceApi = createProviderApi({
  slug: "insurance-provider",
  sessionLabel: "đơn vị bảo hiểm",
  registerPath: "insurance-providers",
  noun: "đơn vị bảo hiểm",
});

export const { register, login, logout, uploadLogo, listBooked, getProfile, saveProfile, listInquiries, updateInquiryStatus, openInquiryContact } = insuranceApi;

export type ProductRow = Record<string, unknown> & { id: string; title: string; status: string };

export const listProducts = (params: { status?: string; q?: string; page?: number; pageSize?: number }) =>
  insuranceApi.listResource<ProductRow>("products", { ...params });

export const createProduct = (body: Record<string, unknown>) =>
  insuranceApi.createItem("products", "product", body, "Chưa xác định sản phẩm đã gửi hay chưa. Tải lại danh sách trước khi gửi lại.");

export const updateProduct = (id: string, body: Record<string, unknown>) =>
  insuranceApi.updateItem("products", "product", id, body, "Chưa xác định cập nhật đã được lưu hay chưa. Tải lại danh sách trước khi thao tác lại.");
