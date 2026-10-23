import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getHealthProviderSession } from "@/lib/health-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
const schema = z.object({ status: z.enum(["contacted", "appointment_confirmed", "completed", "cancelled"]) });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getHealthProviderSession(); if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { id } = await context.params; if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã yêu cầu không hợp lệ." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Trạng thái yêu cầu không hợp lệ." }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().from("health_inquiries").update({ status: parsed.data.status, updated_at: new Date().toISOString() }).eq("id", id).eq("provider_id", session.providerId).select("id,status,updated_at").maybeSingle();
  if (error) { const requestId = logSafeSupabaseError({ route: "/api/mobile/health-provider/inquiries/[id]", operation: "update_inquiry", error }); return NextResponse.json({ error: "Chưa xác định được trạng thái đã cập nhật hay chưa.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  if (!data) return NextResponse.json({ error: "Không tìm thấy yêu cầu." }, { status: 404 });
  return NextResponse.json({ ok: true, inquiry: data });
}
