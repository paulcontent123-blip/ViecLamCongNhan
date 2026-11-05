// Lớp gọi `api/mobile/*` cho các khu web cần phiên đăng nhập (Quản trị, cổng đối tác).
//
// Các route này vốn viết cho app, nhưng chúng đọc đúng cookie phiên mà web đã có, nên trang web gọi được y
// như app. Nhờ vậy web và app dùng chung API, chung quy tắc, không phải thêm gì ở máy chủ.
//
// Mỗi khu chỉ khác nhau ở tên phiên trong thông báo lỗi, nên dùng chung một nhà máy thay vì chép hai lần.
// Quy tắc xử lý lỗi (bản sao của app, xem WEB_APP_SYNC.md mục 1.4 ở repo app):
//  - 401: phiên đã hết hạn ‑ nói rõ để người dùng đăng nhập lại, đừng báo là lỗi mạng.
//  - 403: giữ nguyên thông báo của máy chủ (thiếu quyền, chưa được xác minh…).
//  - 409: bản ghi vừa đổi ở nơi khác ‑ bảo tải lại, KHÔNG thử lại ngầm.
//  - Mất mạng hoặc 5xx khi GHI: "chưa xác định" ‑ thao tác có thể đã vào cơ sở dữ liệu, không được tự gửi lại.

import { requestJson, WorkerServiceError, type RequestOptions } from "@/lib/worker-service-client";

export { WorkerServiceError as MobileApiError };
export type { RequestOptions };

export type MobileQuery = Record<string, string | number | boolean | undefined | null>;

/** Bỏ tham số rỗng rồi ghép query. Giá trị rỗng nghĩa là "không lọc" nên không gửi lên. */
export function buildMobileQuery(params: MobileQuery): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export type MobileListResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  /** Trường phụ riêng của từng route (`usage`, `plans`, `account`, `newCount`…). */
  extra: Record<string, unknown>;
};

function messageFrom(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string") {
    return (data as { error: string }).error;
  }
  return fallback;
}

export type MobileClient = {
  /** Đọc một danh sách phân trang. Phản hồi trả sai trang bị coi là lạ và báo lỗi. */
  list<T>(path: string, params: MobileQuery, options?: RequestOptions): Promise<MobileListResult<T>>;
  /** Đọc một bản ghi lẻ; trả nguyên phần thân để nơi gọi tự lấy trường cần. */
  get<T extends Record<string, unknown>>(path: string, options?: RequestOptions): Promise<T>;
  post<T extends Record<string, unknown>>(path: string, body: unknown, options?: WriteOptions): Promise<T>;
  patch<T extends Record<string, unknown>>(path: string, body: unknown, options?: WriteOptions): Promise<T>;
  /** Xoá/ẩn một bản ghi; không có thân yêu cầu. Cùng quy tắc "chưa xác định" như thao tác ghi khác. */
  delete<T extends Record<string, unknown>>(path: string, options?: DeleteOptions): Promise<T>;
};

/** Một số route xoá/lưu trữ đòi thân yêu cầu (ví dụ mốc phiên bản `expectedUpdatedAt` của Tài chính). */
export type DeleteOptions = WriteOptions & { body?: unknown };

export type WriteOptions = RequestOptions & {
  /** Câu nhắc khi kết quả chưa xác định; mỗi màn nói rõ phải tải lại cái gì. */
  uncertainMessage?: string;
};

export type MobileClientConfig = {
  /** Tên phiên trong câu báo hết hạn, ví dụ "Quản trị" hoặc "đơn vị đào tạo". */
  sessionLabel: string;
  /** Câu nhắc mặc định khi một thao tác ghi không rõ kết quả. */
  uncertainMessage: string;
  /** Tiền tố đường dẫn. Mặc định `api/mobile`; đăng nhập và đăng ký nằm ở `api`. */
  prefix?: string;
};

export function createMobileClient(config: MobileClientConfig): MobileClient {
  const { sessionLabel, uncertainMessage: defaultUncertain, prefix = "api/mobile" } = config;
  const expired = `Phiên ${sessionLabel} đã hết hạn. Hãy đăng nhập lại rồi thử lại.`;

  function failed(status: number, data: unknown, fallback: string): WorkerServiceError {
    if (status === 401) return new WorkerServiceError(expired, 401, "HTTP");
    if (status === 403) {
      return new WorkerServiceError(messageFrom(data, "Tài khoản của bạn không có quyền với mục này."), 403, "HTTP");
    }
    return new WorkerServiceError(messageFrom(data, fallback), status, "HTTP");
  }

  async function read(path: string, options: RequestOptions) {
    return requestJson(`/${prefix}/${path}`, { method: "GET", headers: { Accept: "application/json" } }, options);
  }

  async function write(method: "POST" | "PATCH" | "DELETE", path: string, body: unknown, options: WriteOptions) {
    const uncertain = options.uncertainMessage ?? defaultUncertain;
    let raw;
    try {
      raw = await requestJson(
        `/${prefix}/${path}`,
        {
          method,
          headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
        options,
      );
    } catch (error) {
      const status = error instanceof WorkerServiceError ? error.status : 0;
      throw new WorkerServiceError(uncertain, status, "UNCERTAIN");
    }

    if (!raw.ok) {
      // 5xx: máy chủ có thể đã ghi xong rồi mới lỗi ở bước trả kết quả.
      if (raw.status >= 500) throw new WorkerServiceError(uncertain, raw.status, "UNCERTAIN");
      throw failed(raw.status, raw.data, "Chưa lưu được thay đổi.");
    }

    const data = (raw.data ?? {}) as Record<string, unknown>;
    if (data.ok !== true) throw new WorkerServiceError(uncertain, raw.status, "UNCERTAIN");
    return data;
  }

  return {
    async list<T>(path: string, params: MobileQuery, options: RequestOptions = {}) {
      const page = Number(params.page ?? 1);
      const pageSize = Number(params.pageSize ?? 20);
      const { ok, status, data } = await read(`${path}${buildMobileQuery({ ...params, page, pageSize })}`, options);
      if (!ok) throw failed(status, data, "Chưa tải được danh sách.");

      const body = (data ?? {}) as Record<string, unknown>;
      const { items, total, hasMore } = body;
      if (
        body.ok !== true ||
        !Array.isArray(items) ||
        !Number.isSafeInteger(total) ||
        body.page !== page ||
        body.pageSize !== pageSize
      ) {
        throw new WorkerServiceError("Phản hồi danh sách không hợp lệ.", status, "RESPONSE");
      }

      const extra: Record<string, unknown> = { ...body };
      for (const key of ["ok", "items", "total", "page", "pageSize", "hasMore"]) delete extra[key];

      const count = total as number;
      return {
        items: items as T[],
        total: count,
        page,
        pageSize,
        // Route nào không trả hasMore (ví dụ `admin/bug-reports`) thì tự suy ra.
        hasMore: typeof hasMore === "boolean" ? hasMore : page * pageSize < count,
        extra,
      };
    },

    async get<T extends Record<string, unknown>>(path: string, options: RequestOptions = {}) {
      const { ok, status, data } = await read(path, options);
      if (!ok) throw failed(status, data, "Chưa tải được nội dung.");
      const body = (data ?? {}) as Record<string, unknown>;
      if (body.ok !== true) throw new WorkerServiceError("Phản hồi không hợp lệ.", status, "RESPONSE");
      return body as T;
    },

    post: <T extends Record<string, unknown>>(path: string, body: unknown, options: WriteOptions = {}) =>
      write("POST", path, body, options) as Promise<T>,

    patch: <T extends Record<string, unknown>>(path: string, body: unknown, options: WriteOptions = {}) =>
      write("PATCH", path, body, options) as Promise<T>,

    delete: <T extends Record<string, unknown>>(path: string, options: DeleteOptions = {}) =>
      write("DELETE", path, options.body, options) as Promise<T>,
  };
}
