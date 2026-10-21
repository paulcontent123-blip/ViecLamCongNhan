import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const profileSchema = z.object({
  providerName: z.string().trim().min(2, "Vui lòng nhập tên đơn vị.").max(160),
  contactName: z.string().trim().min(2, "Vui lòng nhập người phụ trách.").max(120),
  contactPhone: z.string().trim().min(9, "Số điện thoại không hợp lệ.").max(20),
  provinceCode: z.string().trim().max(32).optional(),
  taxCode: z.string().trim().max(32).optional(),
  licenseNumber: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
});

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const session = await getTrainingProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const { data, error } = await createSupabaseAdminClient().from("training_providers").select("id,provider_name,provider_slug,provider_type,contact_name,contact_phone,province_code,tax_code,license_number,description,logo_url,is_verified,account_type,account_tier_expires_at").eq("id", session.providerId).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Chưa tải được hồ sơ đơn vị." }, { status: 500, headers });
  return NextResponse.json({ ok: true, provider: data, email: session.email }, { headers });
}

export async function PATCH(request: NextRequest) {
  const session = await getTrainingProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin hồ sơ không hợp lệ." }, { status: 400, headers });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("update_training_provider_profile_atomically", {
    p_provider_id: session.providerId,
    p_user_id: session.userId,
    p_provider_name: parsed.data.providerName,
    p_contact_name: parsed.data.contactName,
    p_contact_phone: parsed.data.contactPhone,
    p_tax_code: parsed.data.taxCode?.trim() || null,
    p_province_code: parsed.data.provinceCode?.trim() || null,
    p_license_number: parsed.data.licenseNumber?.trim() || null,
    p_description: parsed.data.description?.trim() || null,
  });

  if (error) {
    console.error("PATCH /api/mobile/training-provider/profile failed:", error);
    return NextResponse.json(
      { error: "Chưa xác định được hồ sơ đã lưu hay chưa. Tải lại hồ sơ trước khi thao tác lại." },
      { status: 503, headers },
    );
  }
  if (data !== true) {
    return NextResponse.json(
      { error: "Đơn vị chưa được xác minh hoặc hồ sơ không thuộc phiên đăng nhập này." },
      { status: 403, headers },
    );
  }
  return NextResponse.json({ ok: true }, { headers });
}
