import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

// Hạn mức xem liên hệ tính theo gói; Admin chỉ xác minh/hủy xác minh.
const schema = z.object({ verified: z.boolean() });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Trạng thái xác minh không hợp lệ." }, { status: 400 });
  const updates = { is_verified: parsed.data.verified, updated_at: new Date().toISOString() };
  const { data, error } = await createSupabaseAdminClient().from("rental_providers").update(updates)
    .eq("id", id).select("id,provider_name,is_verified,account_type,account_tier_expires_at,updated_at").maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/rental-providers/[id]", operation: "update_rental_provider_verification", error });
    return NextResponse.json({ error: "Chưa cập nhật được đối tác thuê trọ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Không tìm thấy đối tác thuê trọ." }, { status: 404 });
  return NextResponse.json({ ok: true, provider: data });
}
