import { NextResponse } from "next/server";
import { getRentalProviderSession } from "@/lib/rental-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
export async function GET() {
  const session = await getRentalProviderSession();
  if (!session) return NextResponse.json({ loggedIn: false });
  const { data, error } = await createSupabaseAdminClient().from("rental_providers")
    .select("id,provider_name,is_verified,contact_view_limit").eq("id", session.providerId).maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/auth/rental-provider/me", operation: "load_rental_session_provider", error });
    return NextResponse.json({ error: "Chưa tải được phiên đối tác thuê trọ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ loggedIn: false });
  return NextResponse.json({ loggedIn: true, provider: data, email: session.email });
}
