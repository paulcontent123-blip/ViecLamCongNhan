import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({ verified: z.boolean(), contactViewLimit: z.number().int().min(0).max(10000).optional() });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Trạng thái xác minh hoặc hạn mức không hợp lệ." }, { status: 400 });
  const updates: { is_verified: boolean; contact_view_limit?: number; updated_at: string } = { is_verified: parsed.data.verified, updated_at: new Date().toISOString() };
  if (parsed.data.contactViewLimit !== undefined) updates.contact_view_limit = parsed.data.contactViewLimit;
  const { data, error } = await createSupabaseAdminClient().from("rental_providers").update(updates)
    .eq("id", id).select("id,provider_name,is_verified,contact_view_limit,updated_at").maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/rental-providers/[id]", operation: "update_rental_provider_verification", error });
    return NextResponse.json({ error: "Chưa cập nhật được đối tác thuê trọ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Không tìm thấy đối tác thuê trọ." }, { status: 404 });
  return NextResponse.json({ ok: true, provider: data });
}
