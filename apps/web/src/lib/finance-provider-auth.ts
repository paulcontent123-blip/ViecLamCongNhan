import "server-only";
import { cookies } from "next/headers";
import { FINANCE_PROVIDER_SESSION_COOKIE, verifyFinanceProviderToken } from "@/lib/finance-provider-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

export async function getFinanceProviderSession() {
  const cookie = (await cookies()).get(FINANCE_PROVIDER_SESSION_COOKIE)?.value;
  const session = cookie ? await verifyFinanceProviderToken(cookie) : null;
  if (!session) return null;
  const { data, error } = await createSupabaseAdminClient().from("users").select("role,status")
    .eq("id", session.userId).maybeSingle();
  if (error) {
    logSafeSupabaseError({ route: "/api/auth/finance-provider/*", operation: "session_user_lookup", error });
    return null;
  }
  if (!data || data.role !== "finance_provider" || data.status !== "active") return null;
  return session;
}
