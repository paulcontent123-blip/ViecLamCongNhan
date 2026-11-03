import { NextRequest, NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidate-auth";
import { getEmployerSession } from "@/lib/employer-auth";
import { getFinanceProviderSession } from "@/lib/finance-provider-auth";
import { getHealthProviderSession } from "@/lib/health-provider-auth";
import { getInsuranceProviderSession } from "@/lib/insurance-provider-auth";
import { getRentalProviderSession } from "@/lib/rental-provider-auth";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { BUG_REPORT_DAILY_LIMIT, BUG_REPORT_DUPLICATE_WINDOW_MINUTES, bugReportCreateSchema, type BugReportRole } from "@/lib/bug-reports";

const headers = { "Cache-Control": "private, no-store" };

// Phiên của đúng vai trò mà app báo (app biết đang đăng nhập vai trò nào); người gửi luôn lấy từ phiên, không từ body.
const SESSION_READERS: Record<BugReportRole, () => Promise<{ userId: string } | null>> = {
  candidate: () => getCandidateSession(),
  employer: () => getEmployerSession(),
  training_provider: () => getTrainingProviderSession(),
  rental_provider: () => getRentalProviderSession(),
  insurance_provider: () => getInsuranceProviderSession(),
  finance_provider: () => getFinanceProviderSession(),
  health_provider: () => getHealthProviderSession(),
};

// Gửi báo lỗi ứng dụng (tiêu đề và mô tả). Gửi lại đúng nội dung trong 10 phút trả về báo lỗi cũ, nên app có thể thử lại an toàn khi chưa chắc đã gửi được.
export async function POST(request: NextRequest) {
  const parsed = bugReportCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin báo lỗi chưa hợp lệ." }, { status: 400, headers });
  const input = parsed.data;

  const session = await SESSION_READERS[input.role]().catch(() => null);
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập để gửi báo lỗi." }, { status: 401, headers });

  const supabase = createSupabaseAdminClient();
  const fail = (operation: string, error: unknown) => {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/bug-reports", operation, error: error as Error });
    return NextResponse.json({ error: "Chưa gửi được báo lỗi. Vui lòng thử lại sau.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  };

  // Trùng nội dung trong cửa sổ ngắn: trả báo lỗi cũ (kiểm tra trước giới hạn ngày để thử lại luôn thành công).
  const windowStart = new Date(Date.now() - BUG_REPORT_DUPLICATE_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: same, error: sameError } = await supabase.from("bug_reports").select("id")
    .eq("reporter_user_id", session.userId).eq("title", input.title).eq("description", input.description).gte("created_at", windowStart).limit(1);
  if (sameError) return fail("check_duplicate", sameError);
  if (same && same.length > 0) return NextResponse.json({ ok: true, id: same[0].id, duplicate: true }, { headers });

  const dayStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase.from("bug_reports").select("id", { count: "exact", head: true })
    .eq("reporter_user_id", session.userId).gte("created_at", dayStart);
  if (countError) return fail("count_recent", countError);
  if ((count ?? 0) >= BUG_REPORT_DAILY_LIMIT) {
    return NextResponse.json({ error: `Bạn đã gửi ${BUG_REPORT_DAILY_LIMIT} báo lỗi trong 24 giờ qua. Vui lòng thử lại sau.` }, { status: 429, headers });
  }

  const { data, error } = await supabase.from("bug_reports").insert({
    reporter_user_id: session.userId, reporter_role: input.role, title: input.title, description: input.description,
    app_version: input.appVersion || null, platform: input.platform ?? null,
  }).select("id").single();
  if (error || !data) return fail("create_report", error ?? new Error("insert returned no row"));
  return NextResponse.json({ ok: true, id: data.id }, { status: 201, headers });
}
