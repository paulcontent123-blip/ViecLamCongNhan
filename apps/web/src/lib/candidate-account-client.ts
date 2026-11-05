// Lớp gọi API tài khoản công nhân trên web.
//
// Dùng đúng các route app đang dùng, KHÔNG thêm hay sửa route nào:
//  - `api/auth/candidate/{register-password,login-password,me,logout}`
//  - `api/mobile/candidate/{profile,avatar,applications,discovery-consent,rental-consent}`
// Phiên là cookie `candidate_session` do máy chủ đặt, cùng origin nên trình duyệt tự gửi.
//
// BẢN SAO QUY TẮC CỦA APP (`services/candidateAuthApi.js`): đăng ký và các thao tác ghi mà kết quả không rõ thì
// KHÔNG tự gửi lại; lưu lựa chọn chia sẻ thì đọc lại để xác nhận. Không dùng OTP.

import { MobileApiError, createMobileClient, type MobileListResult } from "@/lib/mobile-session-client";
import { requestJson } from "@/lib/worker-service-client";
import { normalizePhone, profileMatches, type ProfileValues } from "@/lib/candidate-account";

const SESSION = "công nhân";
const UNCERTAIN = "Chưa xác định thao tác đã được lưu hay chưa. Tải lại trước khi thử lại.";

const account = createMobileClient({ sessionLabel: SESSION, uncertainMessage: UNCERTAIN });
const auth = createMobileClient({ sessionLabel: SESSION, uncertainMessage: UNCERTAIN, prefix: "api/auth/candidate" });

export type CandidateSession = { loggedIn: boolean; fullName: string; phone: string; phoneVerified: boolean };

/** Lỗi 400 của hồ sơ kèm lỗi từng ô do máy chủ trả. */
export class CandidateFieldError extends MobileApiError {
  readonly fieldErrors: Record<string, string>;
  constructor(message: string, status: number, fieldErrors: Record<string, string>) {
    super(message, status, "HTTP");
    this.fieldErrors = fieldErrors;
  }
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Đọc phiên hiện tại. `me` không có trường `ok` nên không dùng `get` chung. */
export async function getSession(): Promise<CandidateSession> {
  const raw = await requestJson("/api/auth/candidate/me", { method: "GET", headers: { Accept: "application/json" } }, {});
  if (!raw.ok) throw new MobileApiError("Chưa kiểm tra được phiên đăng nhập.", raw.status, "HTTP");
  const data = (raw.data ?? {}) as { loggedIn?: unknown; candidate?: { phone?: unknown; fullName?: unknown; phoneVerified?: unknown } };
  if (typeof data.loggedIn !== "boolean") throw new MobileApiError("Phản hồi kiểm tra phiên không hợp lệ.", raw.status, "RESPONSE");
  return {
    loggedIn: data.loggedIn,
    fullName: text(data.candidate?.fullName),
    phone: text(data.candidate?.phone),
    phoneVerified: data.candidate?.phoneVerified === true,
  };
}

export async function loginWithPassword(phone: string, password: string): Promise<void> {
  await auth.post(
    "login-password",
    { phone: normalizePhone(phone), password },
    { uncertainMessage: "Chưa xác định đã đăng nhập hay chưa. Tải lại trang để kiểm tra trước khi thử lại." },
  );
}

/**
 * Đăng ký bằng mật khẩu. Gửi hai lần có thể tạo trùng, nên kết quả chưa rõ thì KHÔNG gửi lại: người dùng đăng nhập
 * bằng số điện thoại và mật khẩu vừa nhập (nếu tài khoản đã tạo) như app.
 */
export async function registerWithPassword(values: { fullName: string; phone: string; province: string; password: string }): Promise<void> {
  await auth.post(
    "register-password",
    { fullName: values.fullName.trim(), phone: normalizePhone(values.phone), province: values.province.trim(), password: values.password },
    { uncertainMessage: "Chưa xác định tài khoản đã được tạo hay chưa. Hãy thử đăng nhập bằng số điện thoại và mật khẩu vừa nhập, đừng đăng ký lại." },
  );
}

export async function logout(): Promise<void> {
  await auth.post("logout", {});
}

// ───────── Hồ sơ ─────────

export type CandidateProfile = Record<string, unknown> & { fullName: string; phone: string };

export async function getProfile(): Promise<CandidateProfile> {
  const data = await account.get<{ profile?: unknown }>("candidate/profile");
  if (!data.profile || typeof data.profile !== "object") throw new MobileApiError("Phản hồi hồ sơ không hợp lệ.", 0, "RESPONSE");
  return data.profile as CandidateProfile;
}

/**
 * Lưu hồ sơ rồi ĐỌC LẠI để xác nhận (PATCH chỉ trả `ok`). Lỗi 4xx thì báo thẳng kèm lỗi từng ô; mất mạng/5xx hoặc đọc
 * lại không khớp thì giữ "chưa xác định" và KHÔNG gửi PATCH lần nữa.
 */
export async function saveProfile(body: Record<string, unknown>, sent: ProfileValues): Promise<CandidateProfile> {
  let uncertain: MobileApiError | null = null;
  try {
    const raw = await requestJson(
      "/api/mobile/candidate/profile",
      { method: "PATCH", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) },
      {},
    );
    if (!raw.ok) {
      const data = (raw.data ?? {}) as { error?: unknown; fieldErrors?: unknown };
      if (raw.status === 401) throw new MobileApiError("Phiên công nhân đã hết hạn. Hãy đăng nhập lại rồi thử lại.", 401, "HTTP");
      if (raw.status < 500) {
        const fields = data.fieldErrors && typeof data.fieldErrors === "object" ? data.fieldErrors : {};
        const entries = Object.entries(fields as Record<string, unknown>).filter(([, v]) => typeof v === "string") as [string, string][];
        throw new CandidateFieldError(text(data.error) || "Chưa lưu được hồ sơ.", raw.status, Object.fromEntries(entries));
      }
      uncertain = new MobileApiError(UNCERTAIN, raw.status, "UNCERTAIN");
    }
  } catch (error) {
    if (error instanceof CandidateFieldError) throw error;
    if (error instanceof MobileApiError && error.status === 401) throw error;
    uncertain = new MobileApiError(UNCERTAIN, 0, "UNCERTAIN");
  }
  try {
    const latest = await getProfile();
    if (profileMatches(latest, sent)) return latest;
  } catch {
    // Đọc lại hỏng: vẫn là chưa xác định, không gửi lại PATCH.
  }
  throw uncertain ?? new MobileApiError("Máy chủ phản hồi nhưng hồ sơ chưa khớp. Tải lại để kiểm tra trước khi thao tác tiếp.", 0, "UNCERTAIN");
}

/** Xoá tài khoản (và toàn bộ dữ liệu gắn với nó). Máy chủ từ chối nếu còn yêu cầu đổi quà đang chờ. */
export async function deleteAccount(): Promise<void> {
  await account.delete("candidate/profile", {
    uncertainMessage: "Chưa xác định tài khoản đã được xóa hay chưa. Tải lại trang để kiểm tra trước khi thử lại.",
  });
}

// ───────── Ảnh đại diện ─────────

export async function getAvatar(): Promise<string | null> {
  const data = await account.get<{ avatarUrl?: unknown }>("candidate/avatar");
  return typeof data.avatarUrl === "string" ? data.avatarUrl : null;
}

/** Tải ảnh đại diện (JPG/PNG/WEBP, tối đa 5MB). Dùng fetch thẳng vì là multipart. */
export async function uploadAvatar(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const uncertain = "Chưa xác định ảnh đã lưu hay chưa. Tải lại hồ sơ trước khi gửi lại.";
  let response: Response;
  try {
    response = await fetch("/api/mobile/candidate/avatar", { method: "POST", body: form });
  } catch {
    throw new MobileApiError(uncertain, 0, "UNCERTAIN");
  }
  const data = (await response.json().catch(() => null)) as { ok?: unknown; avatarUrl?: unknown; error?: unknown } | null;
  if (!response.ok) {
    if (response.status === 401) throw new MobileApiError("Phiên công nhân đã hết hạn. Hãy đăng nhập lại rồi thử lại.", 401, "HTTP");
    if (response.status >= 500) throw new MobileApiError(uncertain, response.status, "UNCERTAIN");
    throw new MobileApiError(text(data?.error) || "Chưa tải được ảnh đại diện.", response.status, "HTTP");
  }
  if (data?.ok !== true || typeof data.avatarUrl !== "string" || !data.avatarUrl.startsWith("https://")) {
    throw new MobileApiError(uncertain, 0, "UNCERTAIN");
  }
  return data.avatarUrl;
}

// ───────── Đơn ứng tuyển ─────────

export type ApplicationRow = Record<string, unknown> & { id: string; status: string };

export const listApplications = (params: { page?: number; pageSize?: number }): Promise<MobileListResult<ApplicationRow>> =>
  account.list<ApplicationRow>("candidate/applications", { ...params });

// ───────── Chia sẻ hồ sơ ─────────

export type ConsentKind = "training" | "rental";
const CONSENT_PATH: Record<ConsentKind, string> = { training: "candidate/discovery-consent", rental: "candidate/rental-consent" };

export async function getConsent(kind: ConsentKind): Promise<boolean> {
  const data = await account.get<{ enabled?: unknown }>(CONSENT_PATH[kind]);
  if (typeof data.enabled !== "boolean") throw new MobileApiError("Lựa chọn chia sẻ hồ sơ không hợp lệ.", 0, "RESPONSE");
  return data.enabled;
}

/**
 * Bật/tắt chia sẻ hồ sơ. Lỗi 4xx (ví dụ 403 chưa xác minh số điện thoại) báo thẳng; chưa rõ kết quả thì đọc lại để
 * xác nhận và KHÔNG gửi lại PATCH.
 */
export async function setConsent(kind: ConsentKind, enabled: boolean): Promise<boolean> {
  const message = "Chưa xác định lựa chọn chia sẻ đã lưu hay chưa. Tải lại trạng thái trước khi thao tác lại.";
  let uncertain: MobileApiError;
  try {
    const data = await account.patch<{ enabled?: unknown }>(CONSENT_PATH[kind], { enabled }, { uncertainMessage: message });
    if (data.enabled === enabled) return enabled;
    uncertain = new MobileApiError(message, 0, "UNCERTAIN");
  } catch (error) {
    if (error instanceof MobileApiError && error.code === "HTTP") throw error;
    uncertain = error instanceof MobileApiError ? error : new MobileApiError(message, 0, "UNCERTAIN");
  }
  try {
    if ((await getConsent(kind)) === enabled) return enabled;
  } catch {
    // Không gửi lại PATCH.
  }
  throw uncertain;
}

// ───────── Yêu cầu xóa tài khoản (cần Admin xác nhận) ─────────

export type DeletionRequest = {
  id: string;
  status: "pending" | "rejected" | string;
  reason: string | null;
  requested_at: string;
  handled_at: string | null;
  admin_note: string | null;
};

/** Yêu cầu gần nhất đang chờ hoặc bị từ chối; null nếu chưa gửi. */
export async function getDeletionRequest(): Promise<DeletionRequest | null> {
  const data = await account.get<{ request?: unknown }>("candidate/deletion-request");
  return data.request && typeof data.request === "object" ? (data.request as DeletionRequest) : null;
}

/** Gửi yêu cầu xóa. Lặp lại an toàn: đang có yêu cầu chờ thì máy chủ trả lại chính yêu cầu đó, không tạo trùng. */
export async function requestDeletion(reason?: string): Promise<DeletionRequest> {
  const data = await account.post<{ request?: unknown }>("candidate/deletion-request", reason ? { reason } : {}, {
    uncertainMessage: "Chưa xác định yêu cầu xóa tài khoản đã gửi hay chưa. Tải lại trang để kiểm tra.",
  });
  if (!data.request || typeof data.request !== "object") {
    throw new MobileApiError("Chưa xác nhận được yêu cầu xóa tài khoản đã gửi.", 0, "UNCERTAIN");
  }
  return data.request as DeletionRequest;
}

export async function cancelDeletion(): Promise<void> {
  await account.delete("candidate/deletion-request", {
    uncertainMessage: "Chưa xác định yêu cầu đã được rút lại hay chưa. Tải lại trang để kiểm tra.",
  });
}
