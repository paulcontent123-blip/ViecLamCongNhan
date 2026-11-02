// Thu hồi phiên khi mật khẩu bị đổi hoặc đặt lại. Không import server-only để test được ngoài Next.
// Phiên là JWT có iat (giây); phiên cấp trước mốc đổi mật khẩu thì bị từ chối.

/** Cho phép lệch đồng hồ giữa máy chủ web và cơ sở dữ liệu: phiên cấp ngay sau khi tự đổi mật khẩu không bị thu hồi nhầm. */
export const SESSION_REVOCATION_SKEW_SECONDS = 5;

export function isSessionRevoked(session: object, passwordChangedAt: string | null | undefined): boolean {
  if (!passwordChangedAt) return false;
  const changedMs = Date.parse(passwordChangedAt);
  // Dữ liệu mốc không đọc được hoặc phiên không có iat: từ chối (không mở quyền khi không chắc).
  if (!Number.isFinite(changedMs)) return true;
  const iat = (session as { iat?: unknown }).iat;
  if (typeof iat !== "number") return true;
  return iat < Math.floor(changedMs / 1000) - SESSION_REVOCATION_SKEW_SECONDS;
}
