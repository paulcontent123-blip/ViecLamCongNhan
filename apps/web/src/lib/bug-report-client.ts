// Lớp gọi API báo lỗi trên web.
//
// Dùng route có sẵn `POST /api/mobile/bug-reports` (app đang dùng, hỗ trợ sẵn nền tảng "web"), KHÔNG thêm hay sửa route nào.
// Máy chủ lấy người gửi từ phiên của đúng vai trò được báo, nên web phải biết đang đăng nhập vai trò nào.
//
// BẢN SAO QUY TẮC CỦA APP (`services/bugReportApi.js`): mất mạng hay phản hồi không đọc được là "chưa xác định" nhưng gửi lại
// an toàn, vì máy chủ trả lại báo lỗi cũ khi nhận đúng nội dung đó trong 10 phút (không tạo bản trùng). Web không tự gửi lại.

import type { BugReportRole } from "@/lib/bug-reports";
import { MobileApiError } from "@/lib/mobile-session-client";
import { requestJson } from "@/lib/worker-service-client";

export const BUG_REPORT_LIMITS = Object.freeze({ titleMin: 3, titleMax: 100, descriptionMin: 10, descriptionMax: 2000 });

const ROLE_FROM_ACCOUNT: Record<string, BugReportRole> = {
  candidate: "candidate",
  training: "training_provider",
  health: "health_provider",
  insurance: "insurance_provider",
  finance: "finance_provider",
  rental: "rental_provider",
};

export const REPORTER_ROLE_LABEL: Record<BugReportRole, string> = {
  candidate: "Người lao động",
  employer: "Nhà tuyển dụng",
  training_provider: "Đơn vị đào tạo",
  health_provider: "Cơ sở y tế",
  insurance_provider: "Đơn vị bảo hiểm",
  finance_provider: "Đơn vị tài chính",
  rental_provider: "Chủ trọ",
};

/** Vai trò đang đăng nhập (Nhà tuyển dụng, Công nhân hoặc một loại Đối tác); null nếu chưa đăng nhập vai trò nào gửi được. */
export async function detectReporterRole(): Promise<BugReportRole | null> {
  const [employer, account] = await Promise.all([
    fetch("/api/auth/employer/me").then((res) => res.json()).catch(() => null) as Promise<{ loggedIn?: unknown } | null>,
    fetch("/api/auth/account").then((res) => res.json()).catch(() => null) as Promise<{ loggedIn?: unknown; role?: unknown } | null>,
  ]);
  if (employer?.loggedIn === true) return "employer";
  if (account?.loggedIn === true && typeof account.role === "string") return ROLE_FROM_ACCOUNT[account.role] ?? null;
  return null;
}

/** Phần chú thích tự thêm vào cuối mô tả để Admin tái hiện lỗi; không chứa dữ liệu cá nhân. */
export function buildContextNote(page: string): string {
  const parts = [page ? `Trang: ${page}` : ""].filter(Boolean);
  return parts.length ? `\n\n[${parts.join(" · ")}]` : "";
}

export async function submitBugReport(input: {
  role: BugReportRole;
  title: string;
  description: string;
}): Promise<{ id: string; duplicate: boolean }> {
  const uncertain =
    "Chưa xác định báo lỗi đã được gửi hay chưa. Bạn có thể bấm Gửi lại: nếu báo lỗi đã được lưu, hệ thống không tạo bản trùng.";
  let raw;
  try {
    raw = await requestJson(
      "/api/mobile/bug-reports",
      {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ role: input.role, title: input.title.trim(), description: input.description.trim(), platform: "web" }),
      },
      {},
    );
  } catch {
    throw new MobileApiError(uncertain, 0, "UNCERTAIN");
  }
  const data = (raw.data ?? {}) as { ok?: unknown; id?: unknown; duplicate?: unknown; error?: unknown };
  if (raw.status === 401) throw new MobileApiError("Bạn cần đăng nhập để gửi báo lỗi.", 401, "HTTP");
  if (!raw.ok) {
    // 5xx: có thể máy chủ đã ghi rồi mới lỗi; gửi lại vẫn an toàn nên chỉ nhắc, không khoá.
    if (raw.status >= 500) throw new MobileApiError(typeof data.error === "string" ? data.error : uncertain, raw.status, "UNCERTAIN");
    throw new MobileApiError(typeof data.error === "string" ? data.error : "Chưa gửi được báo lỗi. Vui lòng thử lại sau.", raw.status, "HTTP");
  }
  if (data.ok !== true || typeof data.id !== "string" || !data.id) throw new MobileApiError(uncertain, 0, "UNCERTAIN");
  return { id: data.id, duplicate: data.duplicate === true };
}
