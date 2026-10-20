import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
const schema = z.object({ verified: z.boolean() });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Trạng thái xác minh không hợp lệ." }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().from("training_providers").update({ is_verified: parsed.data.verified, updated_at: new Date().toISOString() }).eq("id", id).select("id,provider_name,is_verified").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Chưa cập nhật được xác minh đơn vị." }, { status: 500 });
  return NextResponse.json({ ok: true, provider: data });
}
