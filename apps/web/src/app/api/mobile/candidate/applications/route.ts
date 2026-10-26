import { NextRequest, NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get("pageSize")) || 20));
  const supabase = createSupabaseAdminClient();
  const { data: candidateRows, error: candidateError } = await supabase.from("candidates").select("id").eq("user_id", session.userId);
  if (candidateError) return NextResponse.json({ error: "Không tải được lịch sử ứng tuyển." }, { status: 500 });
  if (!candidateRows?.length) return NextResponse.json({ ok: true, items: [], page, pageSize, total: 0, hasMore: false });
  const { data, error, count } = await supabase.from("applications")
    .select("id,status,created_at,jobs(title,slug,province_code,industry)", { count: "exact" })
    .in("candidate_id", candidateRows.map(row => row.id))
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return NextResponse.json({ error: "Không tải được lịch sử ứng tuyển." }, { status: 500 });
  return NextResponse.json({ ok: true, items: data || [], page, pageSize, total: count || 0, hasMore: page * pageSize < (count || 0) });
}
