import "server-only";
import { redirect } from "next/navigation";
import { getCandidateSession } from "@/lib/candidate-auth";
import { ROUTES } from "@/lib/routes";

/**
 * Chặn trang tài khoản công nhân khi chưa đăng nhập hoặc CHƯA được Admin xác nhận.
 *
 * Công nhân đăng ký bằng số điện thoại + mật khẩu nên `users.is_verified = false` cho tới khi Admin xác nhận. Gọi
 * `getCandidateSession()` KHÔNG kèm `allowUnverifiedPasswordSession` thì phiên chưa xác nhận trả về null, nên web chặn đúng
 * nhóm này mà không cần sửa BE (app vẫn dùng chế độ cho phép phiên chưa xác minh như cũ).
 * Middleware chỉ bảo vệ /admin và /tuyen-dung/dashboard, nên trang tự chặn ở đây thay vì sửa middleware.
 */
export async function requireCandidatePage() {
  const session = await getCandidateSession();
  if (!session) redirect(ROUTES.congNhanLogin);
  return session;
}

export async function getCandidatePageSession() {
  return getCandidateSession();
}
