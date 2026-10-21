import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/auth";
import { createTrainingProviderToken, TRAINING_PROVIDER_SESSION_COOKIE, TRAINING_PROVIDER_SESSION_MAX_AGE } from "@/lib/training-provider-session";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({ identifier: z.string().trim().min(3).max(254), password: z.string().min(1).max(128) });
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Email/SĐT hoặc mật khẩu không hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const identifier = parsed.data.identifier;
  const query = () => supabase.from("users").select("id,email,password_hash,role,status,training_providers(id,provider_name)")
    .eq("role", "training_provider").eq("status", "active");
  const byEmail = await query().eq("email", identifier.toLowerCase()).maybeSingle();
  if (byEmail.error) {
    const requestId = logSafeSupabaseError({
      route: "/api/auth/training-provider/login",
      operation: "lookup_by_email",
      error: byEmail.error,
    });
    return NextResponse.json(
      { error: "Lỗi hệ thống, vui lòng thử lại.", requestId },
      { status: 500, headers: { "X-Request-Id": requestId } },
    );
  }

  let user = byEmail.data;
  if (!user) {
    const byPhone = await query().eq("phone", identifier).maybeSingle();
    if (byPhone.error) {
      const requestId = logSafeSupabaseError({
        route: "/api/auth/training-provider/login",
        operation: "lookup_by_phone",
        error: byPhone.error,
      });
      return NextResponse.json(
        { error: "Lỗi hệ thống, vui lòng thử lại.", requestId },
        { status: 500, headers: { "X-Request-Id": requestId } },
      );
    }
    user = byPhone.data;
  }
  const provider = Array.isArray(user?.training_providers) ? user.training_providers[0] : user?.training_providers;
  if (!user || !provider || !user.password_hash || !(await verifyPassword(parsed.data.password, user.password_hash))) {
    return NextResponse.json({ error: "Email/SĐT hoặc mật khẩu không đúng." }, { status: 401 });
  }
  const token = await createTrainingProviderToken({ userId: user.id, providerId: provider.id, email: user.email ?? identifier, providerName: provider.provider_name });
  const response = NextResponse.json({ ok: true, provider: { id: provider.id, providerName: provider.provider_name } });
  response.cookies.set(TRAINING_PROVIDER_SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TRAINING_PROVIDER_SESSION_MAX_AGE });
  return response;
}
