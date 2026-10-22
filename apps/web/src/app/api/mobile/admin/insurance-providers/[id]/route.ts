import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
const schema = z.object({ verified: z.boolean().optional(), contactViewLimit: z.number().int().min(0).max(100000).optional() }).refine(value => value.verified !== undefined || value.contactViewLimit !== undefined);
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { id } = await context.params; if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã đối tác không hợp lệ." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Thông tin cập nhật không hợp lệ." }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().from("insurance_providers").update({
    ...(parsed.data.verified !== undefined ? { is_verified: parsed.data.verified } : {}),
    ...(parsed.data.contactViewLimit !== undefined ? { contact_view_limit: parsed.data.contactViewLimit } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", id).select("id,provider_name,is_verified,contact_view_limit").maybeSingle();
  if (error) { const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/insurance-providers/[id]", operation: "update_provider", error }); return NextResponse.json({ error: "Chưa cập nhật được đối tác bảo hiểm.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  if (!data) return NextResponse.json({ error: "Không tìm thấy đối tác bảo hiểm." }, { status: 404 });
  return NextResponse.json({ ok: true, provider: data }, { headers: { "Cache-Control": "private, no-store" } });
}
