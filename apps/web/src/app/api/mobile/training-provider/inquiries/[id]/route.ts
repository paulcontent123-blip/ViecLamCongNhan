import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
const schema = z.object({ status: z.enum(["contacted", "advising", "registered", "closed", "cancelled"]) });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getTrainingProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Trạng thái yêu cầu không hợp lệ." }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().from("vocational_inquiries").update({ status: parsed.data.status, updated_at: new Date().toISOString() }).eq("id", id).eq("provider_id", session.providerId).select("id,status").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Chưa cập nhật được trạng thái yêu cầu." }, { status: 404 });
  return NextResponse.json({ ok: true, inquiry: data });
}
