import "server-only";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const RENTAL_PROVIDER_SESSION_COOKIE = "rental_provider_session";
export const RENTAL_PROVIDER_SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function secretKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET chưa được cấu hình.");
  return new TextEncoder().encode(secret);
}

export interface RentalProviderSession extends JWTPayload {
  userId: string;
  providerId: string;
  email: string;
  providerName: string;
}

export async function createRentalProviderToken(payload: RentalProviderSession) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime(`${RENTAL_PROVIDER_SESSION_MAX_AGE}s`).sign(secretKey());
}

export async function verifyRentalProviderToken(token: string): Promise<RentalProviderSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.providerId !== "string" || typeof payload.userId !== "string") return null;
    return payload as unknown as RentalProviderSession;
  } catch { return null; }
}
