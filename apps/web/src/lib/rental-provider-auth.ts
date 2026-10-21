import "server-only";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { RENTAL_PROVIDER_SESSION_COOKIE, verifyRentalProviderToken } from "@/lib/rental-provider-session";

export async function getRentalProviderSession() {
  const token = (await cookies()).get(RENTAL_PROVIDER_SESSION_COOKIE)?.value;
  const session = token ? await verifyRentalProviderToken(token) : null;
  if (!session) return null;
  const { data } = await createSupabaseAdminClient().from("users").select("role,status")
    .eq("id", session.userId).maybeSingle();
  if (!data || data.role !== "rental_provider" || data.status !== "active") return null;
  return session;
}
