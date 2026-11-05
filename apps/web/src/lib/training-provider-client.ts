// Lớp gọi API cho cổng Đơn vị đào tạo trên web.
//
// Dùng đúng các route app đang dùng, không thêm route mới:
//  - `api/training-providers` (đăng ký) và `api/auth/training-provider/*` (đăng nhập, phiên, đăng xuất)
//  - `api/mobile/training-provider/*` (hồ sơ, khóa học, yêu cầu, hồ sơ học viên, Kho học viên, gói & đơn)
//
// BẢN SAO QUY TẮC GHI CỦA APP (`services/trainingProviderApi.js`): sau một thao tác ghi mà phản hồi không rõ
// ràng thì ĐỌC LẠI và đối chiếu; chỉ khi khớp mới coi là đã lưu. Không bao giờ tự gửi lại.

import { createMobileClient, MobileApiError, type MobileListResult } from "@/lib/mobile-session-client";
import { profileMatches, type ProfileFormValues } from "@/lib/training-provider-portal";

export { MobileApiError as TrainingApiError };

const UNCERTAIN = "Chưa xác định thao tác đã được lưu hay chưa. Tải lại trang để kiểm tra trước khi làm lại.";

/** Đăng ký và đăng nhập nằm ngoài `api/mobile`. */
const auth = createMobileClient({ sessionLabel: "đơn vị đào tạo", uncertainMessage: UNCERTAIN, prefix: "api" });

/** Toàn bộ dữ liệu của cổng nằm dưới `api/mobile/training-provider/`. */
const portal = createMobileClient({ sessionLabel: "đơn vị đào tạo", uncertainMessage: UNCERTAIN });

const P = "training-provider";

// ───────── Phiên ─────────

export type ProviderSession = { loggedIn: boolean; email?: string; provider?: Record<string, unknown> };

export async function register(body: Record<string, unknown>) {
  const data = await auth.post<{ provider?: { id?: unknown } }>("training-providers", body, {
    // Đăng ký trùng lặp tạo hai tài khoản nên tuyệt đối không gửi lại; chỉ dẫn người dùng đi thử đăng nhập.
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
    "auth/training-provider/login",
    { identifier, password },
    // Đăng nhập lặp lại không gây hại, nên sai thông tin thì cứ báo lỗi để người dùng nhập lại.
    { uncertainMessage: "Chưa xác định đã đăng nhập hay chưa. Tải lại trang để kiểm tra." },
  );
  if (typeof data.provider?.id !== "string") {
    throw new MobileApiError("Chưa đăng nhập được đơn vị đào tạo.", 0, "RESPONSE");
  }
}

export async function logout() {
  await auth.post("auth/training-provider/logout", {}, { uncertainMessage: "Chưa xác định đã đăng xuất hay chưa." });
}

// ───────── Hồ sơ và logo ─────────

export type ProviderProfile = Record<string, unknown> & { id: string; provider_name: string; is_verified: boolean };

export async function getProfile(): Promise<ProviderProfile & { email: string }> {
  const data = await portal.get<{ provider?: unknown; email?: unknown }>(`${P}/profile`);
  if (!data.provider || typeof data.provider !== "object") {
    throw new MobileApiError("Phản hồi hồ sơ không hợp lệ.", 0, "RESPONSE");
  }
  return {
    ...(data.provider as ProviderProfile),
    email: typeof data.email === "string" ? data.email : "",
  };
}

/**
 * Lưu hồ sơ rồi ĐỌC LẠI để xác nhận.
 *
 * PATCH chỉ trả `{ ok, isVerified, verificationRequired }`, không trả hồ sơ, nên không đọc lại thì không biết
 * đã lưu đúng chưa. Đọc lại hỏng thì giữ nguyên trạng thái "chưa xác định" và KHÔNG gửi PATCH lần nữa.
 * Lưu ý nghiệp vụ: đổi thông tin pháp lý làm MẤT xác minh, nên trả về cờ này cho giao diện báo người dùng.
 */
export async function saveProfile(
  values: ProfileFormValues,
  body: Record<string, unknown>,
): Promise<{ profile: ProviderProfile & { email: string }; verificationRequired: boolean }> {
  let uncertain: Error | null = null;
  let verificationRequired = false;
  try {
    const data = await portal.patch<{ verificationRequired?: unknown }>(`${P}/profile`, body, {
      uncertainMessage: "Chưa xác định được hồ sơ đã lưu hay chưa. Tải lại hồ sơ trước khi thao tác lại.",
    });
    verificationRequired = data.verificationRequired === true;
  } catch (error) {
    // Lỗi dữ liệu (4xx) thì nói thẳng cho người dùng sửa; còn lại là chưa xác định, phải đọc lại mới biết.
    if (error instanceof MobileApiError && error.status > 0 && error.status < 500) throw error;
    uncertain = error instanceof Error ? error : new Error(UNCERTAIN);
  }

  try {
    const latest = await getProfile();
    if (profileMatches(latest, values)) return { profile: latest, verificationRequired: verificationRequired || !latest.is_verified };
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

/** Tải logo: dùng fetch thẳng vì đây là multipart, không phải JSON. */
export async function uploadLogo(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  let response: Response;
  try {
    response = await fetch(`/api/mobile/${P}/logo`, { method: "POST", body: form });
  } catch {
    throw new MobileApiError(
      "Chưa xác nhận được logo đã lưu. Tải lại hồ sơ trước khi thử lại.",
      0,
      "UNCERTAIN",
    );
  }
  const data = (await response.json().catch(() => null)) as { ok?: unknown; url?: unknown; error?: unknown } | null;
  if (!response.ok) {
    if (response.status >= 500) {
      throw new MobileApiError("Chưa xác nhận được logo đã lưu. Tải lại hồ sơ trước khi thử lại.", response.status, "UNCERTAIN");
    }
    throw new MobileApiError(
      typeof data?.error === "string" ? data.error : "Chưa tải được logo.",
      response.status,
      "HTTP",
    );
  }
  if (data?.ok !== true || typeof data.url !== "string" || !data.url.startsWith("https://")) {
    throw new MobileApiError("Chưa xác nhận được logo đã lưu. Tải lại hồ sơ trước khi thử lại.", 0, "UNCERTAIN");
  }
  return data.url;
}

// ───────── Khóa học ─────────

export type CourseRow = Record<string, unknown> & { id: string; title: string; status: string };

export const listCourses = (params: { status?: string; q?: string; page?: number; pageSize?: number }) =>
  portal.list<CourseRow>(`${P}/courses`, { ...params });

export async function createCourse(body: Record<string, unknown>) {
  const data = await portal.post<{ course?: { id?: unknown } }>(`${P}/courses`, body, {
    uncertainMessage: "Chưa xác định khóa học đã gửi hay chưa. Tải lại danh sách trước khi gửi lại.",
  });
  if (typeof data.course?.id !== "string") {
    throw new MobileApiError("Chưa xác nhận được khóa học đã gửi.", 0, "UNCERTAIN");
  }
  return data.course.id;
}

export async function updateCourse(id: string, body: Record<string, unknown>) {
  const data = await portal.patch<{ course?: { id?: unknown } }>(`${P}/courses/${encodeURIComponent(id)}`, body, {
    uncertainMessage: "Chưa xác định cập nhật đã được lưu hay chưa. Tải lại danh sách trước khi thao tác lại.",
  });
  if (data.course?.id !== id) {
    throw new MobileApiError(
      "Chưa xác nhận được cập nhật khóa học. Tải lại danh sách trước khi thao tác lại.",
      0,
      "UNCERTAIN",
    );
  }
}

// ───────── Yêu cầu tư vấn ─────────

export type InquiryRow = Record<string, unknown> & { id: string; full_name: string; status: string };

export const listInquiries = (params: { status?: string; q?: string; page?: number; pageSize?: number }) =>
  portal.list<InquiryRow>(`${P}/inquiries`, { ...params });

/** Đổi trạng thái rồi đọc lại đúng bản ghi đó để xác nhận, như app làm. */
export async function updateInquiryStatus(id: string, status: string) {
  let uncertain: Error | null = null;
  try {
    const data = await portal.patch<{ inquiry?: { id?: unknown; status?: unknown } }>(
      `${P}/inquiries/${encodeURIComponent(id)}`,
      { status },
      { uncertainMessage: "Chưa xác định được trạng thái đã lưu hay chưa. Tải lại danh sách để kiểm tra." },
    );
    if (data.inquiry?.id === id && data.inquiry.status === status) return;
    uncertain = new MobileApiError("Phản hồi cập nhật trạng thái không hợp lệ.", 0, "UNCERTAIN");
  } catch (error) {
    if (error instanceof MobileApiError && error.status > 0 && error.status < 500) throw error;
    uncertain = error instanceof Error ? error : new Error(UNCERTAIN);
  }
  const confirmed = await readOne<InquiryRow>(`${P}/inquiries`, id);
  if (confirmed?.status === status) return;
  throw uncertain;
}

/** Mở liên hệ của một yêu cầu. Cũng tiêu hao hạn mức tháng như hồ sơ học viên và trả về số lượt đã dùng. */
export async function openInquiryContact(id: string): Promise<ContactResult> {
  const data = await portal.post<Record<string, unknown>>(
    `${P}/inquiries/${encodeURIComponent(id)}/contact`,
    {},
    { uncertainMessage: "Chưa xác định được quyền mở liên hệ. Tải lại danh sách trước khi thao tác tiếp." },
  );
  if (typeof data.phone !== "string" || !data.phone.trim()) {
    throw new MobileApiError("Chưa xác nhận được quyền xem liên hệ.", 0, "RESPONSE");
  }
  return {
    phone: data.phone,
    email: typeof data.email === "string" && data.email.trim() ? data.email : null,
    viewedCount: Number.isSafeInteger(data.viewedCount) ? (data.viewedCount as number) : 0,
    viewLimit: Number.isSafeInteger(data.viewLimit) ? (data.viewLimit as number) : 0,
  };
}

// ───────── Hồ sơ học viên ─────────

export type ApplicationRow = Record<string, unknown> & { id: string; full_name: string; status: string };

export const listApplications = (params: { status?: string; q?: string; page?: number; pageSize?: number }) =>
  portal.list<ApplicationRow>(`${P}/applications`, { ...params });

export async function updateApplicationStatus(id: string, status: string) {
  let uncertain: Error | null = null;
  try {
    const data = await portal.patch<{ application?: { id?: unknown; status?: unknown } }>(
      `${P}/applications/${encodeURIComponent(id)}`,
      { status },
      { uncertainMessage: "Chưa xác định được trạng thái hồ sơ đã lưu hay chưa. Tải lại danh sách để kiểm tra." },
    );
    if (data.application?.id === id && data.application.status === status) return;
    uncertain = new MobileApiError("Phản hồi cập nhật trạng thái hồ sơ không hợp lệ.", 0, "UNCERTAIN");
  } catch (error) {
    if (error instanceof MobileApiError && error.status > 0 && error.status < 500) throw error;
    uncertain = error instanceof Error ? error : new Error(UNCERTAIN);
  }
  const confirmed = await readOne<ApplicationRow>(`${P}/applications`, id);
  if (confirmed?.status === status) return;
  throw uncertain;
}

export type ContactResult = { phone: string; email: string | null; viewedCount: number; viewLimit: number };

export async function openApplicationContact(id: string): Promise<ContactResult> {
  const data = await portal.post<Record<string, unknown>>(
    `${P}/applications/${encodeURIComponent(id)}/contact`,
    {},
    { uncertainMessage: "Chưa xác định được quyền mở liên hệ. Tải lại danh sách trước khi thao tác tiếp." },
  );
  if (
    typeof data.phone !== "string" ||
    !data.phone.trim() ||
    !Number.isSafeInteger(data.viewedCount) ||
    !Number.isSafeInteger(data.viewLimit)
  ) {
    throw new MobileApiError("Chưa xác nhận được quyền xem liên hệ hồ sơ.", 0, "RESPONSE");
  }
  return {
    phone: data.phone,
    email: typeof data.email === "string" && data.email.trim() ? data.email : null,
    viewedCount: data.viewedCount as number,
    viewLimit: data.viewLimit as number,
  };
}

// ───────── Kho học viên ─────────

export type LearnerRow = Record<string, unknown> & { id: string; full_name: string };

/** Khóa không được phép xuất hiện trong danh sách Kho học viên ‑ app cũng kiểm tra đúng những khóa này. */
const CONTACT_KEYS = ["phone", "email", "zalo", "user_id"];

export async function listLearners(params: {
  q?: string;
  province?: string;
  industry?: string;
  page?: number;
  pageSize?: number;
}): Promise<MobileListResult<LearnerRow>> {
  const result = await portal.list<LearnerRow>(`${P}/candidates`, { ...params });
  // Chặn rò rỉ: danh sách chỉ được chứa hồ sơ ẩn danh, liên hệ phải mở từng người theo hạn mức.
  if (result.items.some((item) => CONTACT_KEYS.some((key) => key in item))) {
    throw new MobileApiError("Phản hồi Kho học viên chứa thông tin liên hệ không được phép hiển thị.", 0, "RESPONSE");
  }
  return result;
}

export async function openLearnerContact(id: string): Promise<ContactResult> {
  const data = await portal.post<Record<string, unknown>>(
    `${P}/candidates/${encodeURIComponent(id)}/contact`,
    {},
    { uncertainMessage: "Chưa xác định được quyền mở liên hệ. Tải lại Kho học viên trước khi thao tác tiếp." },
  );
  if (
    typeof data.phone !== "string" ||
    !data.phone.trim() ||
    !Number.isSafeInteger(data.viewedCount) ||
    !Number.isSafeInteger(data.viewLimit)
  ) {
    throw new MobileApiError("Phản hồi mở liên hệ không hợp lệ.", 0, "RESPONSE");
  }
  return {
    phone: data.phone,
    email: typeof data.email === "string" && data.email.trim() ? data.email : null,
    viewedCount: data.viewedCount as number,
    viewLimit: data.viewLimit as number,
  };
}

// ───────── Gói và đơn hàng ─────────

export const listOrders = (params: { page?: number; pageSize?: number }) =>
  portal.list<Record<string, unknown>>(`${P}/orders`, { ...params });

export async function getPaymentMethods() {
  const data = await portal.get<{ bank_transfer?: unknown; momo?: unknown }>(`${P}/payment-methods`);
  if (typeof data.bank_transfer !== "boolean" || typeof data.momo !== "boolean") {
    throw new MobileApiError("Phản hồi phương thức thanh toán không hợp lệ.", 0, "RESPONSE");
  }
  return { bank_transfer: data.bank_transfer, momo: data.momo };
}

export async function createOrder(tier: string, paymentMethod: string) {
  const data = await portal.post<{ payment?: { code?: unknown } }>(
    `${P}/orders`,
    { tier, paymentMethod },
    { uncertainMessage: "Chưa xác định đơn đã tạo hay chưa. Tải lại lịch sử đơn trước khi thử lại." },
  );
  const code = data.payment?.code;
  if (typeof code !== "string" || !code) {
    throw new MobileApiError("Chưa xác nhận được đơn đã tạo. Tải lại lịch sử đơn trước khi thử lại.", 0, "UNCERTAIN");
  }
  return code;
}

/** Chi tiết thanh toán của một đơn (thông tin chuyển khoản hoặc ví MoMo). */
export async function getOrderPayment(code: string) {
  const data = await portal.get<{ payment?: unknown }>(`${P}/orders/${encodeURIComponent(code.toUpperCase())}`);
  const payment = data.payment as { code?: unknown } | null;
  if (!payment || typeof payment !== "object" || payment.code !== code.toUpperCase()) {
    throw new MobileApiError("Phản hồi chi tiết thanh toán không hợp lệ.", 0, "RESPONSE");
  }
  return payment as Record<string, unknown>;
}

/**
 * Báo "tôi đã chuyển tiền" để Admin đối soát.
 *
 * Phản hồi không rõ thì ĐỌC LẠI đơn và đối chiếu cờ `confirmed`, như app làm; không gửi PATCH lần hai.
 */
export async function setOrderConfirmed(code: string, confirmed: boolean) {
  let uncertain: Error | null = null;
  try {
    const data = await portal.patch<{ payment?: { confirmed?: unknown } }>(
      `${P}/orders/${encodeURIComponent(code.toUpperCase())}`,
      { confirmed },
      { uncertainMessage: "Chưa xác định được thông báo thanh toán đã lưu hay chưa. Tải lại trạng thái đơn." },
    );
    if (data.payment?.confirmed === confirmed) return;
    uncertain = new MobileApiError("Phản hồi thông báo thanh toán không hợp lệ.", 0, "UNCERTAIN");
  } catch (error) {
    if (error instanceof MobileApiError && error.status > 0 && error.status < 500) throw error;
    uncertain = error instanceof Error ? error : new Error(UNCERTAIN);
  }
  try {
    const latest = await getOrderPayment(code);
    if (latest.confirmed === confirmed) return;
  } catch {
    // Đọc lại hỏng: vẫn chưa xác định, không gửi lại.
  }
  throw uncertain;
}

// ───────── Dùng chung ─────────

/**
 * Đọc lại một bản ghi qua chính route danh sách (`?id=...&page=1&pageSize=1`).
 * Các route của cổng không có đường dẫn chi tiết riêng, nên app cũng đọc lại theo cách này.
 */
async function readOne<T extends { id: string }>(path: string, id: string): Promise<T | null> {
  try {
    const result = await portal.list<T>(path, { id, page: 1, pageSize: 1 });
    const item = result.items[0];
    return result.total === 1 && item?.id === id ? item : null;
  } catch {
    return null;
  }
}
