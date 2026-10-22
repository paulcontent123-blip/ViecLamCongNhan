import { NextResponse } from "next/server";
import { getInsuranceProviderSession } from "@/lib/insurance-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
export async function GET() {
  const session = await getInsuranceProviderSession();
  if (!session) return NextResponse.json({ loggedIn: false });
  const { data, error } = await createSupabaseAdminClient().from("insurance_providers")
    .select("id,provider_name,is_verified,contact_view_limit").eq("id", session.providerId).maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/auth/insurance-provider/me", operation: "provider_session_lookup", error });
    return NextResponse.json({ error: "Lỗi hệ thống, vui lòng thử lại.", requestId }, { status: 503 });
  }
  if (!data) return NextResponse.json({ loggedIn: false });
  return NextResponse.json({ loggedIn: true, provider: data, email: session.email }, { headers: { "Cache-Control": "private, no-store" } });
}
