import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth";
import { createHealthProviderToken, HEALTH_PROVIDER_SESSION_COOKIE, HEALTH_PROVIDER_SESSION_MAX_AGE } from "@/lib/health-provider-session";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const secureEvidenceUrl = z.string().trim().url().max(1000).refine(value => value.startsWith("https://"), "URL hồ sơ chứng minh phải dùng HTTPS.").optional().or(z.literal(""));
const schema = z.object({ providerName: z.string().trim().min(2).max(160), providerType: z.enum(["hospital", "clinic", "medical_center"]).default("clinic"), contactName: z.string().trim().min(2).max(120), contactPhone: z.string().trim().min(9).max(20), email: z.string().trim().email().max(254), password: z.string().min(8).max(128), provinceCode: z.string().trim().max(32).optional(), address: z.string().trim().max(300).optional(), taxCode: z.string().trim().max(32).optional(), licenseNumber: z.string().trim().max(80).optional(), licenseEvidenceUrl: secureEvidenceUrl });
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin đăng ký không hợp lệ." }, { status: 400 });
  const input = parsed.data; const email = input.email.toLowerCase(); const supabase = createSupabaseAdminClient();
  const { data: user, error: userError } = await supabase.from("users").insert({ full_name: input.contactName, phone: input.contactPhone, email, password_hash: await hashPassword(input.password), role: "health_provider", status: "active" }).select("id").single();
  if (userError || !user) {
    if (userError?.code === "23505") return NextResponse.json({ error: "Email hoặc số điện thoại đã được đăng ký." }, { status: 409 });
    const requestId = userError ? logSafeSupabaseError({ route: "/api/health-providers", operation: "create_user", error: userError }) : undefined;
    return NextResponse.json({ error: "Chưa tạo được tài khoản đối tác y tế.", ...(requestId ? { requestId } : {}) }, { status: 503 });
  }
  const { data: provider, error } = await supabase.from("health_providers").insert({ user_id: user.id, provider_name: input.providerName, provider_slug: `${slugify(input.providerName) || "co-so-y-te"}-${user.id.slice(0, 8)}`, provider_type: input.providerType, contact_name: input.contactName, contact_phone: input.contactPhone, province_code: input.provinceCode || null, address: input.address || null, tax_code: input.taxCode || null, license_number: input.licenseNumber || null, license_evidence_url: input.licenseEvidenceUrl || null }).select("id,provider_name").single();
  if (error || !provider) {
    await supabase.from("users").delete().eq("id", user.id);
    const requestId = error ? logSafeSupabaseError({ route: "/api/health-providers", operation: "create_provider", error }) : undefined;
    return NextResponse.json({ error: "Chưa tạo được hồ sơ cơ sở y tế.", ...(requestId ? { requestId } : {}) }, { status: 503 });
  }
  const token = await createHealthProviderToken({ userId: user.id, providerId: provider.id, email, providerName: provider.provider_name });
  const response = NextResponse.json({ ok: true, provider });
  response.cookies.set(HEALTH_PROVIDER_SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: HEALTH_PROVIDER_SESSION_MAX_AGE });
  return response;
}
