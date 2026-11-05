import "server-only";
import { redirect } from "next/navigation";
import { getCandidateSession } from "@/lib/candidate-auth";
import { ROUTES } from "@/lib/routes";

/**
 * Chặn trang tài khoản công nhân khi chưa đăng nhập.
 *
 * Middleware chỉ bảo vệ /admin và /tuyen-dung/dashboard, nên trang tự chặn ở đây thay vì sửa middleware.
 * Cho phép phiên mật khẩu chưa xác minh số điện thoại, giống các route mobile/candidate. Chặn thật vẫn ở máy chủ:
 * mọi route api/mobile/candidate/* tự kiểm tra phiên và trả 401.
 */
export async function requireCandidatePage() {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) redirect(ROUTES.congNhanLogin);
  return session;
}

export async function getCandidatePageSession() {
  return getCandidateSession({ allowUnverifiedPasswordSession: true });
}
