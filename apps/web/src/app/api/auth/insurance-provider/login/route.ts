import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/auth";
import { createInsuranceProviderToken, INSURANCE_PROVIDER_SESSION_COOKIE, INSURANCE_PROVIDER_SESSION_MAX_AGE } from "@/lib/insurance-provider-session";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({ identifier: z.string().trim().min(3).max(254), password: z.string().min(1).max(128) });
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Email/SĐT hoặc mật khẩu không hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient(); const identifier = parsed.data.identifier;
  const query = () => supabase.from("users").select("id,email,password_hash,role,status,insurance_providers!insurance_providers_user_id_fkey(id,provider_name)")
    .eq("role", "insurance_provider").eq("status", "active");
  let lookup = await query().eq("email", identifier.toLowerCase()).maybeSingle();
  if (lookup.error) {
    const requestId = logSafeSupabaseError({ route: "/api/auth/insurance-provider/login", operation: "lookup_by_email", error: lookup.error });
    return NextResponse.json({ error: "Lỗi hệ thống, vui lòng thử lại.", requestId }, { status: 500, headers: { "X-Request-Id": requestId } });
  }
  if (!lookup.data) lookup = await query().eq("phone", identifier).maybeSingle();
  if (lookup.error) {
    const requestId = logSafeSupabaseError({ route: "/api/auth/insurance-provider/login", operation: "lookup_by_phone", error: lookup.error });
    return NextResponse.json({ error: "Lỗi hệ thống, vui lòng thử lại.", requestId }, { status: 500, headers: { "X-Request-Id": requestId } });
  }
  const user = lookup.data; const provider = Array.isArray(user?.insurance_providers) ? user.insurance_providers[0] : user?.insurance_providers;
  if (!user || !provider || !user.password_hash || !(await verifyPassword(parsed.data.password, user.password_hash))) {
    return NextResponse.json({ error: "Email/SĐT hoặc mật khẩu không đúng." }, { status: 401 });
  }
  const token = await createInsuranceProviderToken({ userId: user.id, providerId: provider.id, email: user.email ?? identifier, providerName: provider.provider_name });
  const response = NextResponse.json({ ok: true, provider: { id: provider.id, providerName: provider.provider_name } });
  response.cookies.set(INSURANCE_PROVIDER_SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: INSURANCE_PROVIDER_SESSION_MAX_AGE });
  return response;
}
