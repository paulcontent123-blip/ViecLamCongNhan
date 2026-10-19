import "server-only";
import { SignJWT, jwtVerify } from "jose";

export const CANDIDATE_SESSION_COOKIE = "candidate_session";
export const CANDIDATE_SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function secretKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET chưa được cấu hình.");
  return new TextEncoder().encode(secret);
}

export interface CandidateSessionPayload {
  userId: string;
  phone: string;
}

export async function createCandidateSessionToken(payload: CandidateSessionPayload) {
  return new SignJWT({ ...payload, role: "candidate" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CANDIDATE_SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifyCandidateSessionToken(token: string): Promise<CandidateSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.role !== "candidate" || typeof payload.userId !== "string" || typeof payload.phone !== "string") return null;
    return { userId: payload.userId, phone: payload.phone };
  } catch {
    return null;
  }
}
