import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { data, error } = await createSupabaseAdminClient().from("vocational_courses")
    .select("id,title,occupation,level,description,requirements,learning_mode,province_code,location,start_date,duration_text,tuition_vnd,support_description,certificate_name,certificate_issuer,capacity,enrollment_deadline,created_at,training_providers!inner(provider_name,is_verified)")
    .eq("id", id).eq("status", "approved").eq("training_providers.is_verified", true).maybeSingle();
  if (error) return NextResponse.json({ error: "Chưa tải được khóa học." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Không tìm thấy khóa học." }, { status: 404 });
  const provider = Array.isArray(data.training_providers) ? data.training_providers[0] : data.training_providers;
  const { training_providers: _ignored, ...course } = data as any;
  return NextResponse.json({ ok: true, course: { ...course, provider_name: provider?.provider_name } }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } });
}
