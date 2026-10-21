import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { createRentalProviderToken, RENTAL_PROVIDER_SESSION_COOKIE, RENTAL_PROVIDER_SESSION_MAX_AGE } from "@/lib/rental-provider-session";

const schema = z.object({
  providerName: z.string().trim().min(2).max(160),
  providerType: z.enum(["individual", "business"]).default("individual"),
  contactName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().min(9).max(20).refine((value) => value.replace(/\D/g, "").length >= 9, "Số điện thoại không hợp lệ."),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  provinceCode: z.string().trim().max(32).optional(),
});
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin không hợp lệ." }, { status: 400 });
  const input = parsed.data;
  const email = input.email.toLowerCase();
  const supabase = createSupabaseAdminClient();
  const { data: user, error: userError } = await supabase.from("users").insert({
    full_name: input.contactName, phone: input.contactPhone, email,
    password_hash: await hashPassword(input.password), role: "rental_provider", status: "active",
  }).select("id").single();
  if (userError || !user) {
    const requestId = userError && userError.code !== "23505"
      ? logSafeSupabaseError({ route: "/api/rental-providers", operation: "create_rental_user", error: userError })
      : undefined;
    const status = userError?.code === "23505" ? 409 : 500;
    return NextResponse.json({
      error: userError?.code === "23505" ? "Email hoặc số điện thoại đã được đăng ký." : "Chưa tạo được tài khoản đối tác thuê trọ.",
      ...(requestId ? { requestId } : {}),
    }, { status, ...(requestId ? { headers: { "X-Request-Id": requestId } } : {}) });
  }
  const { data: provider, error } = await supabase.from("rental_providers").insert({
    user_id: user.id, provider_name: input.providerName,
    provider_slug: `${slugify(input.providerName) || "chu-tro"}-${user.id.slice(0, 8)}`,
    provider_type: input.providerType, contact_name: input.contactName,
    contact_phone: input.contactPhone, province_code: input.provinceCode || null,
  }).select("id,provider_name,is_verified").single();
  if (error || !provider) {
    const { error: rollbackError } = await supabase.from("users").delete().eq("id", user.id);
    const requestId = error
      ? logSafeSupabaseError({ route: "/api/rental-providers", operation: "create_rental_profile", error })
      : undefined;
    const rollbackRequestId = rollbackError
      ? logSafeSupabaseError({ route: "/api/rental-providers", operation: "rollback_rental_user_registration", error: rollbackError })
      : undefined;
    const correlationId = requestId || rollbackRequestId;
    return NextResponse.json({
      error: "Chưa tạo được hồ sơ đối tác thuê trọ.",
      ...(correlationId ? { requestId: correlationId } : {}),
    }, { status: 500, ...(correlationId ? { headers: { "X-Request-Id": correlationId } } : {}) });
  }
  const token = await createRentalProviderToken({ userId: user.id, providerId: provider.id, email, providerName: provider.provider_name });
  const response = NextResponse.json({ ok: true, provider });
  response.cookies.set(RENTAL_PROVIDER_SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: RENTAL_PROVIDER_SESSION_MAX_AGE });
  return response;
}
