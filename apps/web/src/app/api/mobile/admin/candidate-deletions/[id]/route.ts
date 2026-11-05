import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { collectCandidateImageUrls, deleteCloudinaryImages } from "@/lib/candidate-account-cleanup";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

// Admin xử lý một yêu cầu xóa tài khoản của người lao động. Route MỚI.
//  approve: xóa tài khoản bằng hàm có sẵn `delete_candidate_account` (cùng cách app tự xóa), rồi đánh dấu đã xử lý.
//  reject : từ chối, tài khoản giữ nguyên; kèm ghi chú để người dùng đọc.

const headers = { "Cache-Control": "private, no-store" };
const bodySchema = z.object({ action: z.enum(["approve", "reject"]), note: z.string().trim().max(500).optional() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin("admin_users");
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400, headers });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thao tác hoặc ghi chú không hợp lệ." }, { status: 400, headers });

  const supabase = createSupabaseAdminClient();
  const { data: current, error: loadError } = await supabase.from("candidate_deletion_requests")
    .select("id,user_id,status").eq("id", id).maybeSingle();
  if (loadError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-deletions/[id]", operation: "load_request", error: loadError });
    return NextResponse.json({ error: "Chưa tải được yêu cầu.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  if (!current) return NextResponse.json({ error: "Không tìm thấy yêu cầu." }, { status: 404, headers });
  if (current.status !== "pending") {
    return NextResponse.json({ error: "Yêu cầu này đã được xử lý hoặc người dùng đã rút lại." }, { status: 409, headers });
  }

  const now = new Date().toISOString();
  const note = parsed.data.note || null;

  if (parsed.data.action === "approve") {
    // Lấy danh sách ảnh trước khi xóa (hàm SQL xóa luôn các dòng chứa URL) để dọn trên Cloudinary sau đó.
    const imageUrls = await collectCandidateImageUrls(current.user_id);
    const { data: deleted, error } = await supabase.rpc("delete_candidate_account", { p_user_id: current.user_id });
    if (error?.message?.includes("CANDIDATE_HAS_OPEN_REDEMPTIONS")) {
      return NextResponse.json({ error: "Người dùng còn yêu cầu đổi quà đang chờ xử lý. Hãy xử lý xong rồi mới xóa tài khoản." }, { status: 409, headers });
    }
    if (error || deleted !== true) {
      const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-deletions/[id]", operation: "delete_account", error: error ?? new Error("delete_candidate_account returned false") });
      return NextResponse.json({ error: "Chưa xóa được tài khoản.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
    }
    await deleteCloudinaryImages(imageUrls);
  }

  // Chỉ cập nhật khi yêu cầu vẫn đang chờ; hàm xóa tài khoản lặp lại an toàn nên nếu bước này lỗi, bấm lại là xong.
  const { error: updateError } = await supabase.from("candidate_deletion_requests")
    .update({ status: parsed.data.action === "approve" ? "approved" : "rejected", handled_by: auth.session.userId, handled_at: now, admin_note: note })
    .eq("id", id).eq("status", "pending");
  if (updateError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-deletions/[id]", operation: "mark_handled", error: updateError });
    return NextResponse.json({ error: "Đã xử lý tài khoản nhưng chưa cập nhật được yêu cầu. Bấm lại để hoàn tất.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }

  // Không ghi họ tên hay số điện thoại vào nhật ký.
  await logAdminAction(auth.session, `candidate_deletion.${parsed.data.action}`, { type: "user", id: current.user_id }, { requestId: id });
  return NextResponse.json({ ok: true, status: parsed.data.action === "approve" ? "approved" : "rejected" }, { headers });
}
