// Lớp gọi API cho cổng Cơ sở y tế trên web.
//
// Dùng đúng các route app đang dùng, KHÔNG thêm hay sửa route nào:
//  - `api/health-providers` (đăng ký) và `api/auth/health-provider/*` (đăng nhập, phiên, đăng xuất)
//  - `api/mobile/health-provider/*` (hồ sơ, logo, dịch vụ, yêu cầu liên hệ, dịch vụ đã đặt)
//
// BẢN SAO QUY TẮC GHI CỦA APP (`services/healthProviderApi.js`): thao tác ghi mà kết quả không rõ thì KHÔNG
// tự gửi lại; hồ sơ thì đọc lại và đối chiếu rồi mới coi là đã lưu.

import { createMobileClient, MobileApiError, type MobileListResult } from "@/lib/mobile-session-client";
import { profileMatches, type ProfileFormValues } from "@/lib/health-provider-portal";

export { MobileApiError as HealthApiError };

const UNCERTAIN = "Chưa xác định thao tác đã được lưu hay chưa. Tải lại trang để kiểm tra trước khi làm lại.";

/** Đăng ký và đăng nhập nằm ngoài `api/mobile`. */
const auth = createMobileClient({ sessionLabel: "cơ sở y tế", uncertainMessage: UNCERTAIN, prefix: "api" });

/** Toàn bộ dữ liệu của cổng nằm dưới `api/mobile/health-provider/`. */
const portal = createMobileClient({ sessionLabel: "cơ sở y tế", uncertainMessage: UNCERTAIN });

const P = "health-provider";

// ───────── Phiên ─────────

export async function register(body: Record<string, unknown>) {
  const data = await auth.post<{ provider?: { id?: unknown } }>("health-providers", body, {
    // Đăng ký hai lần tạo hai tài khoản nên tuyệt đối không gửi lại; chỉ dẫn người dùng đi thử đăng nhập.
    uncertainMessage:
      "Chưa xác định tài khoản đã được tạo hay chưa. Hãy thử đăng nhập bằng email vừa đăng ký trước khi gửi lại.",
  });
  const id = data.provider?.id;
  if (typeof id !== "string" || !id) {
    throw new MobileApiError(
      "Chưa xác nhận được tài khoản đã tạo. Hãy thử đăng nhập bằng email vừa đăng ký trước khi gửi lại.",
      0,
      "UNCERTAIN",
    );
  }
  return id;
}

export async function login(identifier: string, password: string) {
  const data = await auth.post<{ provider?: { id?: unknown } }>(
    "auth/health-provider/login",
    { identifier, password },
    // Đăng nhập lặp lại không gây hại; sai thông tin thì cứ báo lỗi để người dùng nhập lại.
    { uncertainMessage: "Chưa xác định đã đăng nhập hay chưa. Tải lại trang để kiểm tra." },
  );
  if (typeof data.provider?.id !== "string") {
    throw new MobileApiError("Chưa đăng nhập được cơ sở y tế.", 0, "RESPONSE");
  }
}

export async function logout() {
  await auth.post("auth/health-provider/logout", {}, { uncertainMessage: "Chưa xác định đã đăng xuất hay chưa." });
}

// ───────── Hồ sơ và logo ─────────

export type HealthProfile = Record<string, unknown> & { id: string; provider_name: string; is_verified: boolean };

export async function getProfile(): Promise<HealthProfile & { email: string }> {
  const data = await portal.get<{ provider?: unknown; email?: unknown }>(`${P}/profile`);
  if (!data.provider || typeof data.provider !== "object") {
    throw new MobileApiError("Phản hồi hồ sơ không hợp lệ.", 0, "RESPONSE");
  }
  return { ...(data.provider as HealthProfile), email: typeof data.email === "string" ? data.email : "" };
}

/**
 * Lưu hồ sơ rồi ĐỌC LẠI để xác nhận.
 *
 * PATCH không trả lại hồ sơ nên không đọc lại thì không biết đã lưu đúng chưa. Đọc lại hỏng hoặc không khớp thì
 * giữ trạng thái "chưa xác định" và KHÔNG gửi PATCH lần nữa.
 */
export async function saveProfile(
  values: ProfileFormValues,
  body: Record<string, unknown>,
): Promise<HealthProfile & { email: string }> {
  let uncertain: Error | null = null;
  try {
    await portal.patch(`${P}/profile`, body, {
      uncertainMessage: "Chưa xác định được hồ sơ đã lưu hay chưa. Tải lại hồ sơ trước khi thao tác lại.",
    });
  } catch (error) {
    // Lỗi dữ liệu (4xx) thì nói thẳng cho người dùng sửa; còn lại là chưa xác định, phải đọc lại mới biết.
    if (error instanceof MobileApiError && error.status > 0 && error.status < 500) throw error;
    uncertain = error instanceof Error ? error : new Error(UNCERTAIN);
  }

  try {
    const latest = await getProfile();
    if (profileMatches(latest, values)) return latest;
  } catch {
    // Đọc lại hỏng: vẫn là chưa xác định, không gửi lại PATCH.
  }

  throw (
    uncertain ??
    new MobileApiError(
      "Máy chủ phản hồi nhưng hồ sơ chưa khớp. Tải lại để kiểm tra trước khi thao tác tiếp.",
      0,
      "UNCERTAIN",
    )
  );
}

/** Tải logo: dùng fetch thẳng vì đây là multipart, không phải JSON. Máy chủ nhận PNG, JPG, WEBP tối đa 5MB. */
export async function uploadLogo(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const uncertain = "Chưa xác nhận được logo đã lưu. Tải lại hồ sơ trước khi thử lại.";
  let response: Response;
  try {
    response = await fetch(`/api/mobile/${P}/logo`, { method: "POST", body: form });
  } catch {
    throw new MobileApiError(uncertain, 0, "UNCERTAIN");
  }
  const data = (await response.json().catch(() => null)) as { ok?: unknown; url?: unknown; error?: unknown } | null;
  if (!response.ok) {
    if (response.status >= 500) throw new MobileApiError(uncertain, response.status, "UNCERTAIN");
    throw new MobileApiError(
      typeof data?.error === "string" ? data.error : "Chưa tải được logo.",
      response.status,
      "HTTP",
    );
  }
  if (data?.ok !== true || typeof data.url !== "string" || !data.url.startsWith("https://")) {
    throw new MobileApiError(uncertain, 0, "UNCERTAIN");
  }
  return data.url;
}

// ───────── Dịch vụ y tế ─────────

export type ServiceRow = Record<string, unknown> & { id: string; title: string; status: string };

export const listServices = (params: { status?: string; q?: string; page?: number; pageSize?: number }) =>
  portal.list<ServiceRow>(`${P}/services`, { ...params });

export async function createService(body: Record<string, unknown>): Promise<string> {
  const data = await portal.post<{ service?: { id?: unknown; status?: unknown } }>(`${P}/services`, body, {
    uncertainMessage: "Chưa xác định dịch vụ đã gửi hay chưa. Tải lại danh sách trước khi gửi lại.",
  });
  if (typeof data.service?.id !== "string") {
    throw new MobileApiError("Chưa xác nhận được dịch vụ đã lưu.", 0, "UNCERTAIN");
  }
  return typeof data.service.status === "string" ? data.service.status : "";
}

/** Trả về trạng thái sau khi lưu: sửa dịch vụ đã duyệt sẽ tự về "chờ duyệt". */
export async function updateService(id: string, body: Record<string, unknown>): Promise<string> {
  const data = await portal.patch<{ service?: { id?: unknown; status?: unknown } }>(
    `${P}/services/${encodeURIComponent(id)}`,
    body,
    { uncertainMessage: "Chưa xác định cập nhật đã được lưu hay chưa. Tải lại danh sách trước khi thao tác lại." },
  );
  if (data.service?.id !== id) {
    throw new MobileApiError(
      "Chưa xác nhận được cập nhật dịch vụ. Tải lại danh sách trước khi thao tác lại.",
      0,
      "UNCERTAIN",
    );
  }
  return typeof data.service.status === "string" ? data.service.status : "";
}

/** "Ẩn" dịch vụ: máy chủ lưu trữ dịch vụ (không xoá hẳn); các yêu cầu đã gửi vẫn được giữ. */
export async function archiveService(id: string) {
  const data = await portal.delete<{ service?: { id?: unknown } }>(`${P}/services/${encodeURIComponent(id)}`, {
    uncertainMessage: "Chưa xác định dịch vụ đã ẩn hay chưa. Tải lại danh sách trước khi thao tác lại.",
  });
  if (data.service?.id !== id) {
    throw new MobileApiError("Chưa xác nhận được dịch vụ đã ẩn. Tải lại danh sách để kiểm tra.", 0, "UNCERTAIN");
  }
}

// ───────── Yêu cầu liên hệ ─────────

export type InquiryRow = Record<string, unknown> & { id: string; full_name: string; status: string };

export const listInquiries = (params: { status?: string; q?: string; page?: number; pageSize?: number }) =>
  portal.list<InquiryRow>(`${P}/inquiries`, { ...params });

/**
 * Đổi trạng thái yêu cầu. Route danh sách của Y tế KHÔNG hỗ trợ đọc lại theo mã (không có `?id=`), nên phản hồi
 * không khớp thì không thể tự xác nhận ‑ báo "chưa xác định" và để người dùng tải lại danh sách.
 */
export async function updateInquiryStatus(id: string, status: string) {
  const data = await portal.patch<{ inquiry?: { id?: unknown; status?: unknown } }>(
    `${P}/inquiries/${encodeURIComponent(id)}`,
    { status },
    { uncertainMessage: "Chưa xác định được trạng thái đã lưu hay chưa. Tải lại danh sách để kiểm tra." },
  );
  if (data.inquiry?.id !== id || data.inquiry.status !== status) {
    throw new MobileApiError(
      "Chưa xác nhận được trạng thái đã lưu. Tải lại danh sách để kiểm tra.",
      0,
      "UNCERTAIN",
    );
  }
}

export type ContactResult = { fullName: string; phone: string; viewedCount: number; viewLimit: number };

/** Mở liên hệ là thao tác ghi: trừ vào hạn mức tháng, mở lại cùng yêu cầu trong tháng thì không trừ thêm. */
export async function openInquiryContact(id: string): Promise<ContactResult> {
  const data = await portal.post<Record<string, unknown>>(
    `${P}/inquiries/${encodeURIComponent(id)}/contact`,
    {},
    { uncertainMessage: "Chưa xác định lượt mở liên hệ đã ghi nhận chưa. Tải lại yêu cầu trước khi thử tiếp." },
  );
  if (
    typeof data.phone !== "string" ||
    !data.phone.trim() ||
    !Number.isSafeInteger(data.viewedCount) ||
    !Number.isSafeInteger(data.viewLimit)
  ) {
    throw new MobileApiError("Phản hồi quyền liên hệ không hợp lệ.", 0, "RESPONSE");
  }
  return {
    fullName: typeof data.fullName === "string" ? data.fullName : "",
    phone: data.phone,
    viewedCount: data.viewedCount as number,
    viewLimit: data.viewLimit as number,
  };
}

// ───────── Dịch vụ đã đặt (chỉ xem) ─────────

export type BookedRow = Record<string, unknown> & { id: string; status: string };

/**
 * Route này KHÔNG phân trang (trả tối đa 100 dòng, không có `page`/`pageSize`) nên không dùng `list`,
 * vốn đòi phản hồi khớp trang đã yêu cầu.
 */
export async function listBooked(): Promise<{ items: BookedRow[]; total: number }> {
  const data = await portal.get<{ items?: unknown; total?: unknown }>(`${P}/service-inquiries`);
  if (!Array.isArray(data.items)) throw new MobileApiError("Phản hồi dịch vụ đã đặt không hợp lệ.", 0, "RESPONSE");
  const items = data.items as BookedRow[];
  return { items, total: Number.isSafeInteger(data.total) ? (data.total as number) : items.length };
}

export type { MobileListResult };
