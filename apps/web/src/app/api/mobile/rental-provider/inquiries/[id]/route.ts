import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRentalProviderSession } from "@/lib/rental-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({ status: z.enum(["contacted", "resolved", "cancelled"]) });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getRentalProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Trạng thái yêu cầu không hợp lệ." }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().from("rental_inquiries")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", id).eq("provider_id", session.providerId).select("id,status,updated_at").maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/inquiries/[id]", operation: "update_rental_inquiry_status", error });
    return NextResponse.json({ error: "Chưa cập nhật được trạng thái yêu cầu.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Không tìm thấy yêu cầu thuộc đơn vị." }, { status: 404 });
  return NextResponse.json({ ok: true, inquiry: data });
}
