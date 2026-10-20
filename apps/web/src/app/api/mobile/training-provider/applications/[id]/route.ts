import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ status: z.enum(["new", "viewed", "contacted", "accepted", "rejected"]) });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getTrainingProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã hồ sơ không hợp lệ." }, { status: 400 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Trạng thái hồ sơ không hợp lệ." }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().from("vocational_applications")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", id).eq("provider_id", session.providerId)
    .select("id,status,updated_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Chưa cập nhật được trạng thái hồ sơ." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Không tìm thấy hồ sơ thuộc đơn vị này." }, { status: 404 });
  return NextResponse.json({ ok: true, application: data });
}
