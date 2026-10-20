import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let paging;
  try { paging = parseEmployerListParams(params, []); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số phân trang không hợp lệ." }, { status: 400 }); }
  const { page, pageSize } = paging;
  const q = (params.get("q") || "").trim().slice(0, 100);
  const level = (params.get("level") || "").trim().slice(0, 40);
  const province = (params.get("province") || "").trim().slice(0, 32);
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("vocational_courses").select("id,title,occupation,level,learning_mode,province_code,location,start_date,duration_text,tuition_vnd,support_description,certificate_name,certificate_issuer,capacity,enrollment_deadline,description,requirements,created_at,training_providers!inner(provider_name,is_verified)", { count: "exact" }).eq("status", "approved").eq("training_providers.is_verified", true).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (q) {
    const safeQ = q.replace(/[%,._(),]/g, " ");
    query = query.or(`title.ilike.%${safeQ}%,occupation.ilike.%${safeQ}%`);
  }
  if (level) query = query.eq("level", level);
  if (province) query = query.eq("province_code", province);
  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return NextResponse.json({ error: "Chưa tải được danh sách khóa học." }, { status: 500 });
  const items = (data || []).map((row: any) => ({ ...row, provider_name: Array.isArray(row.training_providers) ? row.training_providers[0]?.provider_name : row.training_providers?.provider_name, training_providers: undefined }));
  const total = count || 0;
  return NextResponse.json({ ok: true, items, total, page, pageSize, hasMore: page * pageSize < total }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } });
}
