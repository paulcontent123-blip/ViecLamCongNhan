import { NextRequest, NextResponse } from "next/server";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";

type CourseRelation = { title: string } | Array<{ title: string }> | null;
type VocationalInquiryListRow = Record<string, unknown> & { vocational_courses: CourseRelation };

export async function GET(request: NextRequest) {
  const session = await getTrainingProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const params = request.nextUrl.searchParams;
  let paging;
  try { paging = parseEmployerListParams(params, ["new", "contacted", "advising", "registered", "closed", "cancelled"]); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số danh sách không hợp lệ." }, { status: 400 }); }
  const { page, pageSize, status } = paging;
  const id = params.get("id") || "";
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã yêu cầu không hợp lệ." }, { status: 400 });
  let query = createSupabaseAdminClient().from("vocational_inquiries")
    .select("id,course_id,full_name,status,message,created_at,vocational_courses(title)", { count: "exact" })
    .eq("provider_id", session.providerId).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (id) query = query.eq("id", id);
  if (status) query = query.eq("status", status);
  const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._(),]/g, " ");
  if (q) query = query.or(`full_name.ilike.%${q}%,message.ilike.%${q}%`);
  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return NextResponse.json({ error: "Chưa tải được yêu cầu học nghề." }, { status: 500 });
  const total = count || 0;
  const rows = (data || []) as unknown as VocationalInquiryListRow[];
  const items = rows.map(({ vocational_courses, ...inquiry }) => ({
    ...inquiry,
    course_title: Array.isArray(vocational_courses) ? vocational_courses[0]?.title : vocational_courses?.title,
  }));
  return NextResponse.json({ ok: true, items, total, page, pageSize, hasMore: page * pageSize < total });
}
