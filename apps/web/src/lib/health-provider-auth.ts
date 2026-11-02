import "server-only";
import { cookies } from "next/headers";
import { HEALTH_PROVIDER_SESSION_COOKIE, verifyHealthProviderToken } from "@/lib/health-provider-session";
import { readSessionUser } from "@/lib/session-user";
import { isSessionRevoked } from "@/lib/session-revocation";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

export async function getHealthProviderSession() {
  const cookie = (await cookies()).get(HEALTH_PROVIDER_SESSION_COOKIE)?.value;
  const session = cookie ? await verifyHealthProviderToken(cookie) : null;
  if (!session) return null;
  const { data, error } = await readSessionUser(session.userId);
  if (error) {
    logSafeSupabaseError({ route: "/api/auth/health-provider/*", operation: "session_user_lookup", error });
    return null;
  }
  return data?.role === "health_provider" && data.status === "active" && !isSessionRevoked(session, data.password_changed_at) ? session : null;
}
