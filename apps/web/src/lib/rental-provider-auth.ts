import "server-only";
import { cookies } from "next/headers";
import { readSessionUser } from "@/lib/session-user";
import { isSessionRevoked } from "@/lib/session-revocation";
import { RENTAL_PROVIDER_SESSION_COOKIE, verifyRentalProviderToken } from "@/lib/rental-provider-session";

export async function getRentalProviderSession() {
  const token = (await cookies()).get(RENTAL_PROVIDER_SESSION_COOKIE)?.value;
  const session = token ? await verifyRentalProviderToken(token) : null;
  if (!session) return null;
  const { data } = await readSessionUser(session.userId);
  if (!data || data.role !== "rental_provider" || data.status !== "active" || isSessionRevoked(session, data.password_changed_at)) return null;
  return session;
}
