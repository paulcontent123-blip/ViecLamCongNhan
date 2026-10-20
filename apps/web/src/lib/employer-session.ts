import "server-only";
import { SignJWT, jwtVerify } from "jose";

// Edge-safe (jose only, không bcrypt) ‑ dùng được trong middleware.ts.
// Xem lib/admin-session.ts để biết lý do tách riêng khỏi lib/auth.ts.

export const EMPLOYER_SESSION_COOKIE = "employer_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 ngày ‑ NTD không cần đăng nhập lại liên tục
export const EMPLOYER_SESSION_MAX_AGE = SESSION_TTL_SECONDS;

function getSecretKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET chưa được cấu hình (xem .env.example)");
  }
  // Dùng chung secret với admin session nhưng khác cookie name + payload shape,
  // nên 2 loại token không thể dùng lẫn cho nhau (route nào cũng tự verify đúng
  // field mình cần, vd employerId chỉ có trong token NTD).
  return new TextEncoder().encode(secret);
}

export interface EmployerSessionPayload {
  userId: string;
  employerId: string;
  email: string;
  companyName: string;
}

export async function createEmployerSessionToken(payload: EmployerSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyEmployerSessionToken(
  token: string,
): Promise<EmployerSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.employerId !== "string") return null;
    return payload as unknown as EmployerSessionPayload;
  } catch {
    return null;
  }
}
