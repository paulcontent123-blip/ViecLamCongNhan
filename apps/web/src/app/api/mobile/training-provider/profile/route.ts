import { NextResponse } from "next/server";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export async function GET() {
  const session = await getTrainingProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { data, error } = await createSupabaseAdminClient().from("training_providers").select("id,provider_name,provider_slug,provider_type,contact_name,contact_phone,province_code,tax_code,license_number,description,logo_url,is_verified,account_type,account_tier_expires_at").eq("id", session.providerId).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Chưa tải được hồ sơ đơn vị." }, { status: 500 });
  return NextResponse.json({ ok: true, provider: data, email: session.email });
}
