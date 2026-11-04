// Lớp gọi `api/mobile/*` cho khu "Dịch vụ công nhân" trên web.
//
// Dùng chính các route mobile mà app đang dùng, không thêm route mới, nên dữ liệu web và app luôn giống nhau.
// Vì chạy cùng origin với trang web nên gọi bằng đường dẫn tương đối; không cần cấu hình địa chỉ backend.
//
// BẢN SAO QUY TẮC GHI CỦA APP (WEB_APP_SYNC.md mục 1.4 ở repo app): thao tác ghi KHÔNG tự gửi lại khi mất mạng
// hoặc máy chủ lỗi 5xx. Khi đó kết quả là "chưa xác định": người dùng phải kiểm tra trước khi gửi lần nữa, vì
// yêu cầu có thể đã được ghi nhận. Chỉ lỗi 4xx (dữ liệu sai, trùng số điện thoại…) mới cho sửa và gửi lại.
// Xem `src/services/http.js` và `*Api.js` bên app để đối chiếu.

export type WorkerServiceErrorCode = "NETWORK" | "TIMEOUT" | "HTTP" | "RESPONSE" | "UNCERTAIN";

export class WorkerServiceError extends Error {
  readonly status: number;
  readonly code: WorkerServiceErrorCode;

  constructor(message: string, status = 0, code: WorkerServiceErrorCode = "HTTP") {
    super(message);
    this.name = "WorkerServiceError";
    this.status = status;
    this.code = code;
  }

  /** Yêu cầu có thể đã được ghi nhận: giao diện phải khóa nút gửi và yêu cầu người dùng kiểm tra lại. */
  get uncertain(): boolean {
    return this.code === "UNCERTAIN";
  }
}

const UNCERTAIN_MESSAGE = "Chưa xác định yêu cầu đã gửi hay chưa. Kiểm tra lại trước khi gửi lần nữa.";
const DEFAULT_TIMEOUT_MS = 15000;

export type RequestOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
};

type RawResponse = { status: number; ok: boolean; data: unknown };

/** Trả về phản hồi đã đọc JSON. Ném lỗi NETWORK/TIMEOUT khi chưa chắc máy chủ đã nhận yêu cầu. */
async function requestJson(url: string, init: RequestInit, options: RequestOptions): Promise<RawResponse> {
  const { fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      // Có phản hồi nhưng không đọc được JSON (trang lỗi của proxy chẳng hạn): coi như máy chủ lỗi.
      throw new WorkerServiceError("Máy chủ trả về dữ liệu không đọc được.", response.status || 502, "RESPONSE");
    }
    return { status: response.status, ok: response.ok, data };
  } catch (error) {
    if (error instanceof WorkerServiceError) throw error;
    if (timedOut || controller.signal.aborted) throw new WorkerServiceError("Kết nối quá thời gian chờ.", 0, "TIMEOUT");
    throw new WorkerServiceError("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.", 0, "NETWORK");
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

function errorMessageFrom(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string") {
    return (data as { error: string }).error;
  }
  return fallback;
}

export type ListResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type ListQuery = Record<string, string | number | undefined | null>;

/** Bỏ tham số rỗng rồi ghép query; giữ đúng cách app gửi để máy chủ nhận cùng một bộ tham số. */
export function buildListQuery(params: ListQuery): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/**
 * Đọc một danh sách công khai. Kiểm tra lại hình dạng phản hồi như app làm: trang và cỡ trang phải đúng
 * cái đã yêu cầu, nếu không thì coi là phản hồi lạ và báo lỗi thay vì hiển thị dữ liệu sai trang.
 */
export async function fetchList<T>(
  path: string,
  params: ListQuery,
  options: RequestOptions = {},
): Promise<ListResult<T>> {
  const page = Number(params.page ?? 1);
  const pageSize = Number(params.pageSize ?? 20);
  const { ok, status, data } = await requestJson(
    `/api/mobile/${path}${buildListQuery({ ...params, page, pageSize })}`,
    { method: "GET", headers: { Accept: "application/json" } },
    options,
  );

  if (!ok) throw new WorkerServiceError(errorMessageFrom(data, "Chưa tải được danh sách."), status, "HTTP");

  const body = (data ?? {}) as Record<string, unknown>;
  const valid =
    body.ok === true &&
    Array.isArray(body.items) &&
    Number.isSafeInteger(body.total) &&
    body.page === page &&
    body.pageSize === pageSize &&
    typeof body.hasMore === "boolean";
  if (!valid) throw new WorkerServiceError("Phản hồi danh sách không hợp lệ.", status, "RESPONSE");

  return {
    items: body.items as T[],
    total: body.total as number,
    page,
    pageSize,
    hasMore: body.hasMore as boolean,
  };
}

/**
 * Đọc một bản ghi chi tiết. `key` là tên trường chứa bản ghi trong phản hồi (`course`, `listing`…).
 * `expectId` là id đã yêu cầu: phản hồi trả bản ghi khác thì báo lỗi, không hiện nội dung của tin khác.
 */
export async function fetchDetail<T extends { id?: unknown }>(
  path: string,
  key: string,
  expectId: string,
  options: RequestOptions = {},
): Promise<T> {
  const { ok, status, data } = await requestJson(
    `/api/mobile/${path}`,
    { method: "GET", headers: { Accept: "application/json" } },
    options,
  );

  if (!ok) throw new WorkerServiceError(errorMessageFrom(data, "Chưa tải được nội dung."), status, "HTTP");

  const body = (data ?? {}) as Record<string, unknown>;
  const record = body[key];
  if (body.ok !== true || !record || typeof record !== "object") {
    throw new WorkerServiceError("Phản hồi chi tiết không hợp lệ.", status, "RESPONSE");
  }
  if ((record as { id?: unknown }).id !== expectId) {
    throw new WorkerServiceError("Phản hồi chi tiết không khớp nội dung đã mở.", status, "RESPONSE");
  }
  return record as T;
}

/**
 * Gửi một yêu cầu (hồ sơ học viên, yêu cầu tư vấn, yêu cầu thuê trọ…).
 *
 * `hasResult` kiểm tra phản hồi có đúng bản ghi vừa tạo hay không. Thiếu bản ghi, mất mạng hay máy chủ 5xx
 * đều cho ra lỗi UNCERTAIN: giao diện phải khóa nút gửi lại, vì yêu cầu có thể đã vào cơ sở dữ liệu.
 */
export async function submitInquiry<T>(
  path: string,
  body: unknown,
  hasResult: (data: Record<string, unknown>) => T | null,
  options: RequestOptions = {},
): Promise<T> {
  let raw: RawResponse;
  try {
    raw = await requestJson(
      `/api/mobile/${path}`,
      {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      options,
    );
  } catch (error) {
    const status = error instanceof WorkerServiceError ? error.status : 0;
    // Không có phản hồi dùng được: không biết máy chủ đã ghi hay chưa.
    throw new WorkerServiceError(UNCERTAIN_MESSAGE, status, "UNCERTAIN");
  }

  if (!raw.ok) {
    // 5xx: máy chủ có thể đã ghi xong rồi mới lỗi ở bước trả kết quả.
    if (raw.status >= 500) throw new WorkerServiceError(UNCERTAIN_MESSAGE, raw.status, "UNCERTAIN");
    throw new WorkerServiceError(errorMessageFrom(raw.data, "Chưa gửi được yêu cầu."), raw.status, "HTTP");
  }

  const data = (raw.data ?? {}) as Record<string, unknown>;
  const result = data.ok === true ? hasResult(data) : null;
  if (result === null || result === undefined) {
    throw new WorkerServiceError(UNCERTAIN_MESSAGE, raw.status, "UNCERTAIN");
  }
  return result;
}

/** Lấy `id` của bản ghi lồng trong phản hồi (`{ inquiry: { id } }`). Trả null nếu thiếu. */
export function nestedId(data: Record<string, unknown>, key: string): string | null {
  const record = data[key];
  if (!record || typeof record !== "object") return null;
  const id = (record as { id?: unknown }).id;
  return typeof id === "string" && id ? id : null;
}

/** Lấy `id` nằm thẳng trong phản hồi (`{ inquiryId }`). Trả null nếu thiếu. */
export function directId(data: Record<string, unknown>, key: string): string | null {
  const id = data[key];
  return typeof id === "string" && id ? id : null;
}
