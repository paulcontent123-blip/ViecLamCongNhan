import "server-only";
import { SignJWT, jwtVerify } from "jose";

export const FINANCE_PROVIDER_SESSION_COOKIE = "finance_provider_session";
export const FINANCE_PROVIDER_SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function secretKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET chưa được cấu hình.");
  return new TextEncoder().encode(secret);
}

export interface FinanceProviderSession {
  userId: string;
  providerId: string;
  email: string;
  providerName: string;
}

export async function createFinanceProviderToken(payload: FinanceProviderSession) {
  return new SignJWT({ ...payload }).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime(`${FINANCE_PROVIDER_SESSION_MAX_AGE}s`).sign(secretKey());
}

export async function verifyFinanceProviderToken(token: string): Promise<FinanceProviderSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.providerId !== "string" || typeof payload.userId !== "string") return null;
    return payload as unknown as FinanceProviderSession;
  } catch { return null; }
}
