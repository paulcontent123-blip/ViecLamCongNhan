import "server-only";
import { SignJWT, jwtVerify } from "jose";

// Tách riêng khỏi lib/auth.ts (bcrypt): file này chỉ dùng jose (Edge-compatible)
// vì được import trong middleware.ts, chạy trên Edge Runtime — bcryptjs dùng
// Node API (process.nextTick, setImmediate) không chạy được ở Edge.

export const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 giờ
export const ADMIN_SESSION_MAX_AGE = SESSION_TTL_SECONDS;

function getSecretKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET chưa được cấu hình (xem .env.example)");
  }
  return new TextEncoder().encode(secret);
}

export interface AdminSessionPayload {
  userId: string;
  email: string;
  fullName: string;
}

export async function createAdminSessionToken(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyAdminSessionToken(
  token: string,
): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as AdminSessionPayload;
  } catch {
    return null;
  }
}
