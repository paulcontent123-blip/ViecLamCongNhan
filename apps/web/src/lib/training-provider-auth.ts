import "server-only";
import { cookies } from "next/headers";
import { TRAINING_PROVIDER_SESSION_COOKIE, verifyTrainingProviderToken } from "@/lib/training-provider-session";
import { readSessionUser } from "@/lib/session-user";
import { isSessionRevoked } from "@/lib/session-revocation";

export async function getTrainingProviderSession() {
  const cookie = (await cookies()).get(TRAINING_PROVIDER_SESSION_COOKIE)?.value;
  const session = cookie ? await verifyTrainingProviderToken(cookie) : null;
  if (!session) return null;
  const { data } = await readSessionUser(session.userId);
  if (!data || data.role !== "training_provider" || data.status !== "active" || isSessionRevoked(session, data.password_changed_at)) return null;
  return session;
}
