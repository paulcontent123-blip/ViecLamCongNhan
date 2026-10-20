import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth";
import { createTrainingProviderToken, TRAINING_PROVIDER_SESSION_COOKIE, TRAINING_PROVIDER_SESSION_MAX_AGE } from "@/lib/training-provider-session";

const schema = z.object({
  providerName: z.string().trim().min(2).max(160), contactName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().min(9).max(20), email: z.string().email().max(254),
  password: z.string().min(8).max(128), provinceCode: z.string().trim().max(32).optional(),
  taxCode: z.string().trim().max(32).optional(), licenseNumber: z.string().trim().max(80).optional(),
});
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin không hợp lệ." }, { status: 400 });
  const input = parsed.data;
  const email = input.email.trim().toLowerCase();
  const supabase = createSupabaseAdminClient();
  const { data: user, error: userError } = await supabase.from("users").insert({
    full_name: input.contactName, phone: input.contactPhone, email,
    password_hash: await hashPassword(input.password), role: "training_provider", status: "active",
  }).select("id").single();
  if (userError || !user) return NextResponse.json({ error: "Email hoặc số điện thoại đã được đăng ký." }, { status: 409 });
  const { data: provider, error } = await supabase.from("training_providers").insert({
    user_id: user.id, provider_name: input.providerName, provider_slug: `${slugify(input.providerName) || "don-vi-dao-tao"}-${user.id.slice(0, 8)}`,
    contact_name: input.contactName, contact_phone: input.contactPhone, province_code: input.provinceCode || null,
    tax_code: input.taxCode || null, license_number: input.licenseNumber || null,
  }).select("id,provider_name").single();
  if (error || !provider) {
    await supabase.from("users").delete().eq("id", user.id);
    return NextResponse.json({ error: "Chưa tạo được hồ sơ đơn vị đào tạo." }, { status: 500 });
  }
  const token = await createTrainingProviderToken({ userId: user.id, providerId: provider.id, email, providerName: provider.provider_name });
  const response = NextResponse.json({ ok: true, provider });
  response.cookies.set(TRAINING_PROVIDER_SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TRAINING_PROVIDER_SESSION_MAX_AGE });
  return response;
}
