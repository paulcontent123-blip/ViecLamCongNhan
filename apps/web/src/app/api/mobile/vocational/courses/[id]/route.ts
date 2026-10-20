import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ProviderRelation = { provider_name: string; is_verified: boolean } | Array<{ provider_name: string; is_verified: boolean }> | null;
type VocationalCourseDetailRow = Record<string, unknown> & { training_providers: ProviderRelation };

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const { data, error } = await createSupabaseAdminClient().from("vocational_courses")
    .select("id,title,occupation,level,description,requirements,learning_mode,province_code,location,start_date,duration_text,tuition_vnd,support_description,certificate_name,certificate_issuer,capacity,enrollment_deadline,created_at,training_providers!inner(provider_name,is_verified)")
    .eq("id", id).eq("status", "approved").eq("training_providers.is_verified", true).maybeSingle();
  if (error) return NextResponse.json({ error: "Chưa tải được khóa học." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Không tìm thấy khóa học." }, { status: 404 });
  const { training_providers, ...course } = data as unknown as VocationalCourseDetailRow;
  const provider = Array.isArray(training_providers) ? training_providers[0] : training_providers;
  return NextResponse.json({ ok: true, course: { ...course, provider_name: provider?.provider_name } }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } });
}
