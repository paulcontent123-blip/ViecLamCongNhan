import "server-only";
import { SignJWT, jwtVerify } from "jose";

export const INSURANCE_PROVIDER_SESSION_COOKIE = "insurance_provider_session";
export const INSURANCE_PROVIDER_SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function secretKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET chưa được cấu hình.");
  return new TextEncoder().encode(secret);
}

export interface InsuranceProviderSession {
  userId: string;
  providerId: string;
  email: string;
  providerName: string;
}

export async function createInsuranceProviderToken(payload: InsuranceProviderSession) {
  return new SignJWT({ ...payload }).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime(`${INSURANCE_PROVIDER_SESSION_MAX_AGE}s`).sign(secretKey());
}

export async function verifyInsuranceProviderToken(token: string): Promise<InsuranceProviderSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.providerId !== "string" || typeof payload.userId !== "string") return null;
    return payload as unknown as InsuranceProviderSession;
  } catch { return null; }
}
