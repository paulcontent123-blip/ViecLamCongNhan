import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

// Yêu cầu xóa tài khoản của nhà tuyển dụng và 5 loại đối tác (cùng mẫu với công nhân, dùng chung bảng
// candidate_deletion_requests vì cột user_id tham chiếu users). Chủ tài khoản chỉ GỬI yêu cầu; Admin xác nhận thì tài khoản mới bị
// ẩn danh hóa bằng hàm delete_business_account.
//  GET     yêu cầu gần nhất đang chờ hoặc bị từ chối (hoặc null)
//  POST    { reason? } gửi yêu cầu (đang có yêu cầu chờ thì trả lại yêu cầu đó, không tạo trùng)
//  DELETE  rút lại yêu cầu đang chờ
// userId luôn lấy từ phiên đã xác thực ở route gọi vào, không nhận từ client.

const headers = { "Cache-Control": "private, no-store" };
const FIELDS = "id,status,reason,requested_at,handled_at,admin_note";
const bodySchema = z.object({ reason: z.string().trim().max(500).optional() });

type SessionReader = () => Promise<{ userId: string } | null>;

function unauthorized() {
  return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
}

function failure(route: string, operation: string, error: unknown, message: string) {
  const requestId = logSafeSupabaseError({ route, operation, error });
  return NextResponse.json({ error: message, requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
}

export function accountDeletionRequestRoute(getSession: SessionReader, route: string) {
  return {
    async GET() {
      const session = await getSession();
      if (!session) return unauthorized();
      const { data, error } = await createSupabaseAdminClient().from("candidate_deletion_requests").select(FIELDS)
        .eq("user_id", session.userId).in("status", ["pending", "rejected"])
        .order("requested_at", { ascending: false }).limit(1).maybeSingle();
      if (error) return failure(route, "load_request", error, "Chưa tải được yêu cầu xóa tài khoản.");
      return NextResponse.json({ ok: true, request: data ?? null }, { headers });
    },

    async POST(request: NextRequest) {
      const session = await getSession();
      if (!session) return unauthorized();
      const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
      if (!parsed.success) return NextResponse.json({ error: "Lý do tối đa 500 ký tự." }, { status: 400, headers });
      const supabase = createSupabaseAdminClient();

      const { data: pending, error: pendingError } = await supabase.from("candidate_deletion_requests").select(FIELDS)
        .eq("user_id", session.userId).eq("status", "pending").maybeSingle();
      if (pendingError) return failure(route, "check_pending", pendingError, "Chưa gửi được yêu cầu xóa tài khoản.");
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
        return failure(route, "create_request", error, "Chưa gửi được yêu cầu xóa tài khoản.");
      }
      return NextResponse.json({ ok: true, request: data }, { status: 201, headers });
    },

    async DELETE() {
      const session = await getSession();
      if (!session) return unauthorized();
      const { error } = await createSupabaseAdminClient().from("candidate_deletion_requests")
        .update({ status: "cancelled", handled_at: new Date().toISOString() })
        .eq("user_id", session.userId).eq("status", "pending");
      if (error) return failure(route, "cancel_request", error, "Chưa rút lại được yêu cầu xóa tài khoản.");
      return NextResponse.json({ ok: true, request: null }, { headers });
    },
  };
}
