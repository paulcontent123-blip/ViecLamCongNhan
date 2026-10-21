import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };
const schema = z.object({ enabled: z.boolean() });

export async function GET() {
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const { data, error } = await createSupabaseAdminClient()
    .from("candidate_rental_visibility_consents")
    .select("consented_at,revoked_at")
    .eq("user_id", session.userId).maybeSingle();
  if (error) return NextResponse.json({ error: "Không tải được lựa chọn chia sẻ hồ sơ." }, { status: 500, headers });
  return NextResponse.json({ ok: true, enabled: Boolean(data && !data.revoked_at), consentedAt: data?.consented_at ?? null }, { headers });
}

export async function PATCH(request: NextRequest) {
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Lựa chọn chia sẻ hồ sơ không hợp lệ." }, { status: 400, headers });

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const result = parsed.data.enabled
    ? await supabase.from("candidate_rental_visibility_consents").upsert({ user_id: session.userId, consented_at: now, revoked_at: null, updated_at: now }, { onConflict: "user_id" }).select("consented_at,revoked_at").single()
    : await supabase.from("candidate_rental_visibility_consents").update({ revoked_at: now, updated_at: now }).eq("user_id", session.userId).is("revoked_at", null).select("consented_at,revoked_at").maybeSingle();
  if (result.error) return NextResponse.json({ error: "Không lưu được lựa chọn chia sẻ hồ sơ." }, { status: 500, headers });
  return NextResponse.json({ ok: true, enabled: parsed.data.enabled, consentedAt: result.data?.consented_at ?? null }, { headers });
}
