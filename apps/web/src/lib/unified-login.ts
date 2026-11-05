// Đăng nhập một ô chung: người dùng chỉ nhập tài khoản và mật khẩu, web tự tìm đúng loại tài khoản rồi đưa về đúng trang.
//
// KHÔNG thêm hay sửa route nào: web lần lượt gọi các route đăng nhập có sẵn (Admin, Nhà tuyển dụng, 5 loại đối tác, Công
// nhân). Route nào trả "sai thông tin" (400/401) thì thử loại kế tiếp; lỗi khác (quá nhiều lần thử, lỗi máy chủ, mất mạng)
// thì dừng và báo ngay, không thử tiếp để không đổ thêm yêu cầu vào chỗ đang lỗi.
// Công nhân đăng ký bằng số điện thoại nên chỉ vào được sau khi Admin xác nhận tài khoản.

import { ROUTES } from "@/lib/routes";

export type LoginRole = "admin" | "employer" | "candidate" | "training" | "health" | "insurance" | "finance" | "rental";

export type LoginTarget = { role: LoginRole; href: string };

export type LoginFailureKind = "invalid" | "pending" | "blocked";

export class LoginError extends Error {
  readonly kind: LoginFailureKind;
  constructor(message: string, kind: LoginFailureKind) {
    super(message);
    this.name = "LoginError";
    this.kind = kind;
  }
}

type Attempt = { role: LoginRole; url: string; body: (identifier: string, password: string) => unknown; href: string };

const identifierBody = (identifier: string, password: string) => ({ identifier, password });

const ADMIN: Attempt = {
  role: "admin",
  url: "/api/auth/admin/login",
  body: (identifier, password) => ({ email: identifier, password }),
  href: ROUTES.admin,
};
const EMPLOYER: Attempt = { role: "employer", url: "/api/auth/employer/login", body: identifierBody, href: ROUTES.ntdDashboard };
const PARTNERS: Attempt[] = [
  { role: "training", url: "/api/auth/training-provider/login", body: identifierBody, href: ROUTES.hocNgheDoiTacDashboard },
  { role: "health", url: "/api/auth/health-provider/login", body: identifierBody, href: ROUTES.yTeDoiTacDashboard },
  { role: "insurance", url: "/api/auth/insurance-provider/login", body: identifierBody, href: ROUTES.baoHiemDoiTacDashboard },
  { role: "finance", url: "/api/auth/finance-provider/login", body: identifierBody, href: ROUTES.taiChinhDoiTacDashboard },
  { role: "rental", url: "/api/auth/rental-provider/login", body: identifierBody, href: ROUTES.thueTroDoiTacDashboard },
];
const CANDIDATE: Attempt = {
  role: "candidate",
  url: "/api/auth/candidate/login-password",
  body: (identifier, password) => ({ phone: identifier.replace(/\D/g, ""), password }),
  href: ROUTES.congNhanAccount,
};

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isCandidatePhone = (value: string) => /^0\d{9}$/.test(value.replace(/\D/g, ""));

/** Thứ tự thử theo dạng tài khoản: email thì có thể là Admin, số điện thoại thì có thể là Công nhân. */
export function loginAttempts(identifier: string): Attempt[] {
  const value = identifier.trim();
  if (isEmail(value)) return [ADMIN, EMPLOYER, ...PARTNERS];
  if (isCandidatePhone(value)) return [CANDIDATE, EMPLOYER, ...PARTNERS];
  return [EMPLOYER, ...PARTNERS];
}

async function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

const NETWORK = "Không kết nối được máy chủ, thử lại sau.";

/** Đăng nhập; trả về loại tài khoản và trang cần chuyển tới. Ném `LoginError` khi không đăng nhập được. */
export async function unifiedLogin(identifierInput: string, password: string): Promise<LoginTarget> {
  const identifier = identifierInput.trim();
  if (identifier.length < 3 || !password) {
    throw new LoginError("Nhập email hoặc số điện thoại và mật khẩu.", "invalid");
  }

  for (const attempt of loginAttempts(identifier)) {
    let response: Response;
    try {
      response = await post(attempt.url, attempt.body(identifier, password));
    } catch {
      throw new LoginError(NETWORK, "blocked");
    }

    if (response.ok) {
      if (attempt.role === "candidate") await requireVerifiedCandidate();
      return { role: attempt.role, href: attempt.href };
    }

    // 400/401: không đúng loại tài khoản này (hoặc sai mật khẩu); thử loại kế tiếp.
    if (response.status === 400 || response.status === 401) continue;

    const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const message = typeof data?.error === "string" ? data.error : "Chưa đăng nhập được. Vui lòng thử lại sau.";
    throw new LoginError(message, "blocked");
  }

  throw new LoginError("Thông tin đăng nhập không đúng. Kiểm tra lại tài khoản và mật khẩu.", "invalid");
}

/**
 * Tài khoản công nhân phải được Admin xác nhận. Mật khẩu đúng nhưng chưa xác nhận thì xóa phiên vừa tạo và báo đang chờ,
 * để người dùng không ở trong trạng thái "đã đăng nhập" mà không vào được gì.
 */
async function requireVerifiedCandidate(): Promise<void> {
  let verified = false;
  try {
    const me = await fetch("/api/auth/candidate/me", { headers: { Accept: "application/json" } });
    const data = (await me.json().catch(() => null)) as { loggedIn?: unknown; candidate?: { phoneVerified?: unknown } } | null;
    verified = data?.loggedIn === true && data.candidate?.phoneVerified === true;
  } catch {
    throw new LoginError(NETWORK, "blocked");
  }
  if (verified) return;
  await post("/api/auth/candidate/logout", {}).catch(() => undefined);
  throw new LoginError(PENDING_MESSAGE, "pending");
}

export const PENDING_MESSAGE =
  "Tài khoản của bạn đang chờ Admin xác nhận. Bạn sẽ đăng nhập được sau khi được xác nhận.";
