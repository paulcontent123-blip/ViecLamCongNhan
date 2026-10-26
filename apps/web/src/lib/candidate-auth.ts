import "server-only";
import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { CANDIDATE_SESSION_COOKIE, verifyCandidateSessionToken, type CandidateSessionPayload } from "@/lib/candidate-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export function normalizeCandidatePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("84") ? `0${digits.slice(2)}` : digits;
  return /^0\d{9}$/.test(local) ? local : null;
}

export function candidatePhoneVariants(phone: string): string[] {
  const normalized = normalizeCandidatePhone(phone);
  if (!normalized) return [];
  return [...new Set([normalized, `+84${normalized.slice(1)}`, `84${normalized.slice(1)}`])];
}

export function hashCandidateOtp(phone: string, code: string): string {
  const secret = process.env.CANDIDATE_OTP_SECRET;
  if (!secret || secret.length < 32) throw new Error("CANDIDATE_OTP_SECRET chưa được cấu hình đủ mạnh.");
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

export async function allowCandidatePasswordAuthAttempt(phone: string, ip: string): Promise<boolean> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("ADMIN_SESSION_SECRET chưa được cấu hình đủ mạnh.");
  const hash = (value: string) => createHmac("sha256", secret).update(`candidate-password-auth:${value}`).digest("hex");
  const { data, error } = await createSupabaseAdminClient().rpc("consume_candidate_password_auth_attempt", {
    p_phone_hash: hash(`phone:${phone}`),
    p_ip_hash: hash(`ip:${ip}`),
  });
  if (error) throw new Error("Không kiểm tra được giới hạn đăng nhập.");
  return data === true;
}

export async function getCandidateSession(options: { allowUnverifiedPasswordSession?: boolean } = {}): Promise<CandidateSessionPayload | null> {
  const token = (await cookies()).get(CANDIDATE_SESSION_COOKIE)?.value;
  const session = token ? await verifyCandidateSessionToken(token) : null;
  if (!session) return null;
  const { data: user } = await createSupabaseAdminClient()
    .from("users").select("role,status,is_verified,phone,password_hash")
    .eq("id", session.userId).maybeSingle();
  if (!user || user.role !== "candidate" || user.status !== "active" || normalizeCandidatePhone(user.phone || "") !== session.phone) return null;
  const phoneVerified = user.is_verified === true;
  if (!phoneVerified && !(options.allowUnverifiedPasswordSession && session.authMethod === "password" && Boolean(user.password_hash))) return null;
  return { ...session, phoneVerified };
}
