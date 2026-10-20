import "server-only";
import { cookies } from "next/headers";
import { TRAINING_PROVIDER_SESSION_COOKIE, verifyTrainingProviderToken } from "@/lib/training-provider-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getTrainingProviderSession() {
  const cookie = (await cookies()).get(TRAINING_PROVIDER_SESSION_COOKIE)?.value;
  const session = cookie ? await verifyTrainingProviderToken(cookie) : null;
  if (!session) return null;
  const { data } = await createSupabaseAdminClient().from("users").select("role,status")
    .eq("id", session.userId).maybeSingle();
  if (!data || data.role !== "training_provider" || data.status !== "active") return null;
  return session;
}
