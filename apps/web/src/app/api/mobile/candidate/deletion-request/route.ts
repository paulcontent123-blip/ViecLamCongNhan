import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

// Yêu cầu xóa tài khoản của công nhân (route MỚI, không thay đổi `DELETE /api/mobile/candidate/profile` đang có).
// Công nhân chỉ GỬI yêu cầu; tài khoản chỉ bị xóa khi Admin xác nhận.
//  GET     yêu cầu gần nhất của chính mình (hoặc null)
//  POST    { reason? } gửi yêu cầu (đang có yêu cầu chờ thì trả lại yêu cầu đó, không tạo trùng)
//  DELETE  rút lại yêu cầu đang chờ

const headers = { "Cache-Control": "private, no-store" };
const FIELDS = "id,status,reason,requested_at,handled_at,admin_note";
const bodySchema = z.object({ reason: z.string().trim().max(500).optional() });

function unauthorized() {
  return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
}

function failure(operation: string, error: unknown, message: string) {
  const requestId = logSafeSupabaseError({ route: "/api/mobile/candidate/deletion-request", operation, error });
  return NextResponse.json({ error: message, requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
}

export async function GET() {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return unauthorized();
  const { data, error } = await createSupabaseAdminClient().from("candidate_deletion_requests").select(FIELDS)
    .eq("user_id", session.userId).in("status", ["pending", "rejected"])
    .order("requested_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return failure("load_request", error, "Chưa tải được yêu cầu xóa tài khoản.");
  return NextResponse.json({ ok: true, request: data ?? null }, { headers });
}

export async function POST(request: NextRequest) {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return unauthorized();
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Lý do tối đa 500 ký tự." }, { status: 400, headers });
  const supabase = createSupabaseAdminClient();

  const { data: pending, error: pendingError } = await supabase.from("candidate_deletion_requests").select(FIELDS)
    .eq("user_id", session.userId).eq("status", "pending").maybeSingle();
  if (pendingError) return failure("check_pending", pendingError, "Chưa gửi được yêu cầu xóa tài khoản.");
  if (pending) return NextResponse.json({ ok: true, request: pending }, { headers });

  const { data, error } = await supabase.from("candidate_deletion_requests")
    .insert({ user_id: session.userId, reason: parsed.data.reason || null }).select(FIELDS).single();
  if (error) {
    // Hai yêu cầu đồng thời: bản kia đã tạo xong, đọc lại để trả đúng yêu cầu đang chờ.
    if (String((error as { code?: unknown }).code ?? "") === "23505") {
      const { data: existing } = await supabase.from("candidate_deletion_requests").select(FIELDS)
        .eq("user_id", session.userId).eq("status", "pending").maybeSingle();
      if (existing) return NextResponse.json({ ok: true, request: existing }, { headers });
    }
    return failure("create_request", error, "Chưa gửi được yêu cầu xóa tài khoản.");
  }
  return NextResponse.json({ ok: true, request: data }, { status: 201, headers });
}

export async function DELETE() {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return unauthorized();
  const { error } = await createSupabaseAdminClient().from("candidate_deletion_requests")
    .update({ status: "cancelled", handled_at: new Date().toISOString() })
    .eq("user_id", session.userId).eq("status", "pending");
  if (error) return failure("cancel_request", error, "Chưa rút lại được yêu cầu xóa tài khoản.");
  return NextResponse.json({ ok: true, request: null }, { headers });
}
