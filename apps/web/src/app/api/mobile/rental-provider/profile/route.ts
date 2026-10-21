import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRentalProviderSession } from "@/lib/rental-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({
  providerName: z.string().trim().min(2).max(160),
  providerType: z.enum(["individual", "business"]),
  contactName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().min(9).max(20).refine((value) => value.replace(/\D/g, "").length >= 9, "Số điện thoại không hợp lệ."),
  provinceCode: z.string().trim().max(32).optional(),
  address: z.string().trim().max(240).optional(),
  description: z.string().trim().max(2000).optional(),
});

export async function GET() {
  const session = await getRentalProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { data, error } = await createSupabaseAdminClient().from("rental_providers")
    .select("id,provider_name,provider_type,contact_name,contact_phone,province_code,address,description,is_verified,contact_view_limit,created_at")
    .eq("id", session.providerId).maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/profile", operation: "load_rental_profile", error });
    return NextResponse.json({ error: "Chưa tải được hồ sơ đối tác thuê trọ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Không tìm thấy hồ sơ đối tác." }, { status: 404 });
  return NextResponse.json({ ok: true, provider: { ...data, email: session.email } });
}

export async function PATCH(request: NextRequest) {
  const session = await getRentalProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin hồ sơ không hợp lệ." }, { status: 400 });
  const input = parsed.data;
  const { data, error } = await createSupabaseAdminClient().rpc("update_rental_provider_profile_atomically", {
    p_provider_id: session.providerId,
    p_user_id: session.userId,
    p_provider_name: input.providerName,
    p_provider_type: input.providerType,
    p_contact_name: input.contactName,
    p_contact_phone: input.contactPhone,
    p_province_code: input.provinceCode || null,
    p_address: input.address || null,
    p_description: input.description || null,
  });
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/profile", operation: "update_rental_profile", error });
    return NextResponse.json({ error: "Chưa lưu được hồ sơ đối tác thuê trọ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (data !== true) return NextResponse.json({ error: "Không tìm thấy hồ sơ thuộc tài khoản này." }, { status: 404 });
  return NextResponse.json({ ok: true, provider: input });
}
