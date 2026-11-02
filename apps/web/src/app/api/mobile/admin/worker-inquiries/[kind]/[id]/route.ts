import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { updateWorkerInquiry } from "@/lib/admin-worker-inquiries";
import { FORWARDING_DISABLED_MESSAGE, isWorkerInquiryKind, validWorkerInquiryId, workerInquiryForwardingEnabled, workerInquiryPatchSchema } from "@/lib/worker-inquiries";

const headers = { "Cache-Control": "private, no-store" };

// Admin đổi trạng thái, ghi chú hoặc chuyển yêu cầu của công nhân cho đối tác. Biên tập và Superadmin đều làm được.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { kind, id } = await params;
  if (!isWorkerInquiryKind(kind) || !validWorkerInquiryId(id)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400, headers });
  const parsed = workerInquiryPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Thông tin cập nhật chưa hợp lệ." }, { status: 400, headers });

  // Chuyển đối tác đang tắt: từ chối cả yêu cầu (không áp dụng một phần).
  if (parsed.data.forward && !workerInquiryForwardingEnabled()) return NextResponse.json({ error: FORWARDING_DISABLED_MESSAGE }, { status: 403, headers });

  const result = await updateWorkerInquiry(kind, id, parsed.data, auth.session.userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, ...(result.requestId ? { requestId: result.requestId } : {}) }, { status: result.status, headers: { ...headers, ...(result.requestId ? { "X-Request-Id": result.requestId } : {}) } });
  }
  // Chỉ ghi nhật ký việc chia sẻ dữ liệu liên hệ cho đối tác và việc đóng yêu cầu; không ghi họ tên hay số điện thoại.
  if (parsed.data.forward) await logAdminAction(auth.session, "worker_inquiry.forward", { type: kind, id });
  else if (parsed.data.adminStatus) await logAdminAction(auth.session, "worker_inquiry.status", { type: kind, id }, { adminStatus: parsed.data.adminStatus });
  return NextResponse.json({ ok: true, item: result.item }, { headers });
}
