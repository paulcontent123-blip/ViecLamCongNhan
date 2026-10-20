import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";

type ProviderRelation = { provider_name: string; is_verified: boolean } | Array<{ provider_name: string; is_verified: boolean }> | null;
type VocationalCourseListRow = Record<string, unknown> & { training_providers: ProviderRelation };

export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const params = request.nextUrl.searchParams;
  let paging;
  try { paging = parseEmployerListParams(params, ["draft", "pending", "approved", "rejected", "hidden", "closed"]); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số danh sách không hợp lệ." }, { status: 400 }); }
  const { page, pageSize, status } = paging;
  const q = (params.get("q") || "").trim().slice(0, 100);
  const id = params.get("id") || "";
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("vocational_courses").select("id,title,occupation,level,status,rejection_reason,created_at,training_providers!inner(provider_name,is_verified)", { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (id) query = query.eq("id", id);
  if (status) query = query.eq("status", status);
  if (q) {
    const safeQ = q.replace(/[%,._(),]/g, " ");
    query = query.or(`title.ilike.%${safeQ}%,occupation.ilike.%${safeQ}%`);
  }
  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return NextResponse.json({ error: "Chưa tải được danh sách khóa học chờ duyệt." }, { status: 500 });
  const rows = (data || []) as unknown as VocationalCourseListRow[];
  const items = rows.map(({ training_providers, ...course }) => {
    const provider = Array.isArray(training_providers) ? training_providers[0] : training_providers;
    return { ...course, provider_name: provider?.provider_name, provider_verified: provider?.is_verified };
  });
  const total = count || 0;
  return NextResponse.json({ ok: true, items, total, page, pageSize, hasMore: page * pageSize < total });
}
