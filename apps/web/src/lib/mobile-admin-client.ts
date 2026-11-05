// Lớp gọi `api/mobile/admin/*` từ trang Quản trị trên web.
//
// Chỉ là `createMobileClient` gắn tên phiên "Quản trị"; toàn bộ quy tắc xử lý lỗi và hình dạng phản hồi
// nằm ở `mobile-session-client.ts` (dùng chung với cổng đối tác).

import {
  buildMobileQuery,
  createMobileClient,
  MobileApiError,
  type MobileListResult,
  type MobileQuery,
  type RequestOptions,
} from "@/lib/mobile-session-client";

export { MobileApiError as AdminApiError };
export type { RequestOptions };
export type AdminQuery = MobileQuery;
export type AdminListResult<T> = MobileListResult<T>;

/** Thao tác quản trị có thể đã được ghi: phải tải lại danh sách trước khi bấm lần nữa. */
const UNCERTAIN = "Chưa xác định thao tác đã được ghi hay chưa. Tải lại danh sách để kiểm tra trước khi làm lại.";

const client = createMobileClient({ sessionLabel: "Quản trị", uncertainMessage: UNCERTAIN });

export const buildAdminQuery = buildMobileQuery;

/** Đọc một danh sách quản trị. */
export const adminList = <T,>(path: string, params: AdminQuery, options: RequestOptions = {}) =>
  client.list<T>(path, params, options);

/** Đọc một bản ghi lẻ, ví dụ liên kết có chữ ký của hồ sơ giấy phép. */
export const adminGet = <T extends Record<string, unknown>>(path: string, options: RequestOptions = {}) =>
  client.get<T>(path, options);

/** Gửi một thay đổi quản trị (duyệt, từ chối, xác minh, đổi hạn mức, ghi chú). */
export const adminPatch = <T extends Record<string, unknown> = Record<string, unknown>>(
  path: string,
  body: unknown,
  options: RequestOptions = {},
) => client.patch<T>(path, body, options);
