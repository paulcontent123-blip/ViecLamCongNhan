// Lớp gọi `api/mobile/admin/*` từ trang Quản trị trên web.
//
// Các route này vốn làm cho app Admin, nhưng chúng dùng đúng cookie phiên Admin mà web đang có
// (`requireAdmin()` trong `lib/admin-auth.ts`), nên trang web gọi được y như app. Nhờ vậy web và app
// luôn thấy cùng dữ liệu và cùng quy tắc, không phải thêm route mới.
//
// Khác `worker-service-client.ts` ở ba điểm, vì đây là thao tác quản trị:
//  - 401 nghĩa là phiên Admin đã hết hạn: nói rõ để người dùng đăng nhập lại, đừng báo "lỗi mạng".
//  - 409 nghĩa là bản ghi đã đổi ở nơi khác (duyệt đồng thời): bảo người dùng tải lại, KHÔNG thử lại ngầm.
//  - Danh sách của Admin không phải route nào cũng trả `hasMore` (ví dụ `admin/bug-reports`), nên tự tính
//    từ `page`, `pageSize` và `total`.

import { requestJson, WorkerServiceError, type RequestOptions } from "@/lib/worker-service-client";

export { WorkerServiceError as AdminApiError };
export type { RequestOptions };

export type AdminListResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  /** Vài route trả thêm số bản ghi đang chờ xử lý (ví dụ báo lỗi mới). */
  extra: Record<string, unknown>;
};

export type AdminQuery = Record<string, string | number | boolean | undefined | null>;

/** Bỏ tham số rỗng rồi ghép query. `status` rỗng nghĩa là "tất cả" nên không gửi lên. */
export function buildAdminQuery(params: AdminQuery): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

function messageFrom(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string") {
    return (data as { error: string }).error;
  }
  return fallback;
}

/** Chuyển mã lỗi HTTP thành thông báo và mã lỗi dùng chung cho mọi màn Admin. */
function failed(status: number, data: unknown, fallback: string): WorkerServiceError {
  if (status === 401) {
    return new WorkerServiceError("Phiên Quản trị đã hết hạn. Hãy đăng nhập lại rồi thử lại.", 401, "HTTP");
  }
  if (status === 403) {
    return new WorkerServiceError(
      messageFrom(data, "Tài khoản của bạn không có quyền với mục này."),
      403,
      "HTTP",
    );
  }
  return new WorkerServiceError(messageFrom(data, fallback), status, "HTTP");
}

/**
 * Đọc một danh sách quản trị.
 *
 * `page` và `pageSize` luôn được gửi để phản hồi có thể đối chiếu; route trả sai trang thì coi là phản hồi
 * lạ và báo lỗi, không hiển thị dữ liệu của trang khác.
 */
export async function adminList<T>(
  path: string,
  params: AdminQuery,
  options: RequestOptions = {},
): Promise<AdminListResult<T>> {
  const page = Number(params.page ?? 1);
  const pageSize = Number(params.pageSize ?? 20);
  const { ok, status, data } = await requestJson(
    `/api/mobile/${path}${buildAdminQuery({ ...params, page, pageSize })}`,
    { method: "GET", headers: { Accept: "application/json" } },
    options,
  );

  if (!ok) throw failed(status, data, "Chưa tải được danh sách.");

  const body = (data ?? {}) as Record<string, unknown>;
  const { items, total, hasMore } = body;
  if (body.ok !== true || !Array.isArray(items) || !Number.isSafeInteger(total) || body.page !== page || body.pageSize !== pageSize) {
    throw new WorkerServiceError("Phản hồi danh sách quản trị không hợp lệ.", status, "RESPONSE");
  }

  // Những gì còn lại là số liệu phụ của riêng từng route (ví dụ `newCount` của báo lỗi).
  const extra: Record<string, unknown> = { ...body };
  for (const key of ["ok", "items", "total", "page", "pageSize", "hasMore"]) delete extra[key];

  const count = total as number;
  return {
    items: items as T[],
    total: count,
    page,
    pageSize,
    // Route nào không trả hasMore thì tự suy ra; route có trả thì tin giá trị của nó.
    hasMore: typeof hasMore === "boolean" ? hasMore : page * pageSize < count,
    extra,
  };
}

/**
 * Gửi một thay đổi quản trị (duyệt, từ chối, xác minh, đổi hạn mức, ghi chú).
 *
 * Mất mạng hay máy chủ 5xx thì KHÔNG tự gửi lại và báo "chưa xác định": thao tác có thể đã được ghi,
 * người dùng phải tải lại danh sách để xem trạng thái thật trước khi bấm lần nữa. Đây là bản sao quy tắc
 * ghi của app (WEB_APP_SYNC.md mục 1.4 ở repo app).
 */
export async function adminPatch<T = Record<string, unknown>>(
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<T> {
  let raw;
  try {
    raw = await requestJson(
      `/api/mobile/${path}`,
      {
        method: "PATCH",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      options,
    );
  } catch (error) {
    const status = error instanceof WorkerServiceError ? error.status : 0;
    throw new WorkerServiceError(
      "Chưa xác định thao tác đã được ghi hay chưa. Tải lại danh sách để kiểm tra trước khi làm lại.",
      status,
      "UNCERTAIN",
    );
  }

  if (!raw.ok) {
    if (raw.status >= 500) {
      throw new WorkerServiceError(
        "Chưa xác định thao tác đã được ghi hay chưa. Tải lại danh sách để kiểm tra trước khi làm lại.",
        raw.status,
        "UNCERTAIN",
      );
    }
    throw failed(raw.status, raw.data, "Chưa lưu được thay đổi.");
  }

  const data = (raw.data ?? {}) as Record<string, unknown>;
  if (data.ok !== true) {
    throw new WorkerServiceError(
      "Chưa xác định thao tác đã được ghi hay chưa. Tải lại danh sách để kiểm tra trước khi làm lại.",
      raw.status,
      "UNCERTAIN",
    );
  }
  return data as T;
}
