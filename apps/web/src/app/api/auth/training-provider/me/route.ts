import { NextResponse } from "next/server";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export async function GET() {
  const session = await getTrainingProviderSession();
  if (!session) return NextResponse.json({ loggedIn: false });
  const { data } = await createSupabaseAdminClient().from("training_providers")
    .select("id,provider_name,is_verified,account_type,account_tier_expires_at").eq("id", session.providerId).maybeSingle();
  if (!data) return NextResponse.json({ loggedIn: false });
  return NextResponse.json({ loggedIn: true, provider: data, email: session.email });
}
