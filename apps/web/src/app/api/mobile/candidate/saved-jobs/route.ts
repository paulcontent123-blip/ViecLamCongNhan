import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

// Việc đã lưu của công nhân. Route MỚI, không thay đổi route nào đang có.
//  GET    ?page&pageSize          danh sách đã lưu (mới nhất trước)
//  GET    ?check=<jobId>          đã lưu tin này chưa
//  POST   { jobId }               lưu (lặp lại an toàn)
//  DELETE ?jobId=<jobId>          bỏ lưu (lặp lại an toàn)

const headers = { "Cache-Control": "private, no-store" };
const MAX_SAVED = 100;
const idSchema = z.string().uuid();

const JOB_FIELDS =
  "id,slug,title,province_code,district,industry,salary_min,salary_max,status,expires_at,created_at,employers(company_name),kcn(name)";

function unauthorized() {
  return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
}

function failure(operation: string, error: unknown, message: string) {
  const requestId = logSafeSupabaseError({ route: "/api/mobile/candidate/saved-jobs", operation, error });
  return NextResponse.json({ error: message, requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
}

export async function GET(request: NextRequest) {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return unauthorized();
  const supabase = createSupabaseAdminClient();
  const params = request.nextUrl.searchParams;

  const check = params.get("check");
  if (check !== null) {
    if (!idSchema.safeParse(check).success) return NextResponse.json({ error: "Mã tin không hợp lệ." }, { status: 400, headers });
    const { data, error } = await supabase.from("candidate_saved_jobs").select("job_id")
      .eq("user_id", session.userId).eq("job_id", check).maybeSingle();
    if (error) return failure("check_saved", error, "Chưa kiểm tra được việc đã lưu.");
    return NextResponse.json({ ok: true, saved: Boolean(data), jobId: check }, { headers });
  }

  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize")) || 20));
  const { data, error, count } = await supabase.from("candidate_saved_jobs")
    .select(`job_id,created_at,jobs(${JOB_FIELDS})`, { count: "exact" })
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .order("job_id", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return failure("list_saved", error, "Chưa tải được việc đã lưu.");
  const total = count ?? 0;
  const items = (data ?? []).map((row) => ({
    id: row.job_id,
    saved_at: row.created_at,
    job: Array.isArray(row.jobs) ? row.jobs[0] ?? null : row.jobs,
  }));
  return NextResponse.json({ ok: true, items, page, pageSize, total, hasMore: page * pageSize < total }, { headers });
}

export async function POST(request: NextRequest) {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return unauthorized();
  const parsed = z.object({ jobId: idSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Mã tin không hợp lệ." }, { status: 400, headers });
  const { jobId } = parsed.data;
  const supabase = createSupabaseAdminClient();

  const { data: job, error: jobError } = await supabase.from("jobs").select("id,status").eq("id", jobId).maybeSingle();
  if (jobError) return failure("load_job", jobError, "Chưa kiểm tra được tin tuyển dụng.");
  if (!job || job.status !== "approved") return NextResponse.json({ error: "Không tìm thấy tin tuyển dụng này." }, { status: 404, headers });

  // Đã lưu rồi thì coi như xong (không tính vào giới hạn).
  const { data: existing, error: existingError } = await supabase.from("candidate_saved_jobs").select("job_id")
    .eq("user_id", session.userId).eq("job_id", jobId).maybeSingle();
  if (existingError) return failure("check_existing", existingError, "Chưa lưu được việc này.");
  if (existing) return NextResponse.json({ ok: true, saved: true, jobId }, { headers });

  const { error } = await supabase.from("candidate_saved_jobs").insert({ user_id: session.userId, job_id: jobId });
  if (error) {
    if (String((error as { message?: unknown }).message ?? "").includes("SAVED_JOBS_LIMIT")) {
      return NextResponse.json({ error: `Đã lưu ${MAX_SAVED} việc. Bỏ lưu một việc trước khi thêm.` }, { status: 409, headers });
    }
    // Hai yêu cầu đồng thời lưu cùng một tin: bản còn lại đã thành công.
    if (String((error as { code?: unknown }).code ?? "") === "23505") return NextResponse.json({ ok: true, saved: true, jobId }, { headers });
    return failure("save_job", error, "Chưa lưu được việc này.");
  }
  return NextResponse.json({ ok: true, saved: true, jobId }, { headers });
}

export async function DELETE(request: NextRequest) {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return unauthorized();
  const jobId = request.nextUrl.searchParams.get("jobId") ?? "";
  if (!idSchema.safeParse(jobId).success) return NextResponse.json({ error: "Mã tin không hợp lệ." }, { status: 400, headers });
  const { error } = await createSupabaseAdminClient().from("candidate_saved_jobs").delete()
    .eq("user_id", session.userId).eq("job_id", jobId);
  if (error) return failure("unsave_job", error, "Chưa bỏ lưu được việc này.");
  return NextResponse.json({ ok: true, saved: false, jobId }, { headers });
}
