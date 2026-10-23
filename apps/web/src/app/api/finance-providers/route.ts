import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth";
import { createFinanceProviderToken, FINANCE_PROVIDER_SESSION_COOKIE, FINANCE_PROVIDER_SESSION_MAX_AGE } from "@/lib/finance-provider-session";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({
  providerName: z.string().trim().min(2).max(160), contactName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().min(9).max(20), email: z.string().email().max(254),
  password: z.string().min(8).max(128), providerType: z.enum(["bank", "finance_company", "remittance_provider", "other"]).default("finance_company"),
  provinceCode: z.string().trim().max(32).optional(), taxCode: z.string().trim().max(32).optional(),
  licenseNumber: z.string().trim().min(1, "Nhập số giấy phép / ủy quyền.").max(80),
  licenseEvidenceUrl: z.string().trim().max(1000).optional().or(z.literal("")).refine(value => !value || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(value), "Liên kết hồ sơ giấy phép không hợp lệ."),
});
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin không hợp lệ." }, { status: 400 });
  const input = parsed.data; const email = input.email.trim().toLowerCase(); const supabase = createSupabaseAdminClient();
  const { data: user, error: userError } = await supabase.from("users").insert({
    full_name: input.contactName, phone: input.contactPhone, email, password_hash: await hashPassword(input.password),
    role: "finance_provider", status: "active",
  }).select("id").single();
  if (userError || !user) {
    if (userError?.code === "23505") return NextResponse.json({ error: "Email hoặc số điện thoại đã được đăng ký." }, { status: 409 });
    const requestId = userError ? logSafeSupabaseError({ route: "/api/finance-providers", operation: "create_user", error: userError }) : undefined;
    return NextResponse.json({ error: "Chưa tạo được tài khoản đối tác tài chính.", ...(requestId ? { requestId } : {}) }, { status: 500 });
  }
  const { data: provider, error } = await supabase.from("finance_providers").insert({
    user_id: user.id, provider_name: input.providerName, provider_slug: `${slugify(input.providerName) || "doi-tac-tai-chinh"}-${user.id.slice(0, 8)}`,
    provider_type: input.providerType, contact_name: input.contactName, contact_phone: input.contactPhone,
    province_code: input.provinceCode || null, tax_code: input.taxCode || null, license_number: input.licenseNumber || null,
    license_evidence_url: input.licenseEvidenceUrl || null,
  }).select("id,provider_name").single();
  if (error || !provider) {
    await supabase.from("users").delete().eq("id", user.id);
    const requestId = error ? logSafeSupabaseError({ route: "/api/finance-providers", operation: "create_provider", error }) : undefined;
    return NextResponse.json({ error: "Chưa tạo được hồ sơ đối tác tài chính.", ...(requestId ? { requestId } : {}) }, { status: 500 });
  }
  const token = await createFinanceProviderToken({ userId: user.id, providerId: provider.id, email, providerName: provider.provider_name });
  const response = NextResponse.json({ ok: true, provider });
  response.cookies.set(FINANCE_PROVIDER_SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: FINANCE_PROVIDER_SESSION_MAX_AGE });
  return response;
}
