import "server-only";
import { cookies } from "next/headers";
import { INSURANCE_PROVIDER_SESSION_COOKIE, verifyInsuranceProviderToken } from "@/lib/insurance-provider-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

export async function getInsuranceProviderSession() {
  const cookie = (await cookies()).get(INSURANCE_PROVIDER_SESSION_COOKIE)?.value;
  const session = cookie ? await verifyInsuranceProviderToken(cookie) : null;
  if (!session) return null;
  const { data, error } = await createSupabaseAdminClient().from("users").select("role,status")
    .eq("id", session.userId).maybeSingle();
  if (error) {
    logSafeSupabaseError({ route: "/api/auth/insurance-provider/*", operation: "session_user_lookup", error });
    return null;
  }
  if (!data || data.role !== "insurance_provider" || data.status !== "active") return null;
  return session;
}
