import { NextRequest, NextResponse } from "next/server";
import { getEmployerSession } from "@/lib/employer-auth";
import { isEmployerVerified, recordCandidateProfileView } from "@/lib/employer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getEmployerSession();
  if (!session) {
    return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  }
  if (!(await isEmployerVerified(session.employerId))) {
    return NextResponse.json(
      { error: "Tài khoản của bạn đang chờ Admin xác minh pháp nhân." },
      { status: 403 },
    );
  }

  const { id: candidateId } = await params;
  const result = await recordCandidateProfileView(session.employerId, candidateId);

  if (!result.allowed) {
    return NextResponse.json({
      allowed: false,
      viewedCount: result.viewedCount,
      limit: result.limit,
      error: `Bạn đã dùng hết ${result.limit} lượt xem hồ sơ ứng viên trong tháng này. Nâng cấp gói để xem thêm.`,
    });
  }

  const supabase = createSupabaseAdminClient();
  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("id, full_name, phone, zalo, province, desired_industry, experience_years")
    .eq("id", candidateId)
    .maybeSingle();

  if (error || !candidate) {
    return NextResponse.json({ error: "Không tìm thấy hồ sơ ứng viên." }, { status: 404 });
  }

  return NextResponse.json({
    allowed: true,
    viewedCount: result.viewedCount,
    limit: result.limit,
    candidate,
  });
}
