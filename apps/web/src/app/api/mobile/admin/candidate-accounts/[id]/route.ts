import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

// Admin xác nhận (hoặc thu hồi xác nhận) một tài khoản công nhân. Route MỚI.
// Chỉ đổi `users.is_verified` của tài khoản có vai trò công nhân và còn hoạt động; không đụng dữ liệu khác.

const headers = { "Cache-Control": "private, no-store" };
const bodySchema = z.object({ verified: z.boolean() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin("admin_users");
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Tài khoản không hợp lệ." }, { status: 400, headers });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Trạng thái xác nhận không hợp lệ." }, { status: 400, headers });

  const { data, error } = await createSupabaseAdminClient().from("users")
    .update({ is_verified: parsed.data.verified })
    .eq("id", id).eq("role", "candidate").eq("status", "active")
    .select("id,full_name,phone,is_verified,created_at").maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-accounts/[id]", operation: "update_verified", error });
    return NextResponse.json({ error: "Chưa lưu được xác nhận tài khoản.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Không tìm thấy tài khoản công nhân này." }, { status: 404, headers });

  // Không ghi họ tên hay số điện thoại vào nhật ký, chỉ ghi kết quả.
  await logAdminAction(auth.session, "candidate_account.verify", { type: "user", id }, { verified: parsed.data.verified });
  return NextResponse.json({ ok: true, item: data }, { headers });
}
