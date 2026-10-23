import "server-only";
import { SignJWT, jwtVerify } from "jose";

export const HEALTH_PROVIDER_SESSION_COOKIE = "health_provider_session";
export const HEALTH_PROVIDER_SESSION_MAX_AGE = 30 * 24 * 60 * 60;
export interface HealthProviderSession { userId: string; providerId: string; email: string; providerName: string; }

function secretKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET chưa được cấu hình.");
  return new TextEncoder().encode(secret);
}
export async function createHealthProviderToken(payload: HealthProviderSession) {
  return new SignJWT({ ...payload }).setProtectedHeader({ alg: "HS256" }).setIssuedAt()
    .setExpirationTime(`${HEALTH_PROVIDER_SESSION_MAX_AGE}s`).sign(secretKey());
}
export async function verifyHealthProviderToken(token: string): Promise<HealthProviderSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.providerId !== "string" || typeof payload.userId !== "string") return null;
    return payload as unknown as HealthProviderSession;
  } catch { return null; }
}
