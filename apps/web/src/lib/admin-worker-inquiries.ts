import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { WORKER_INQUIRY_FIELDS, WORKER_INQUIRY_TABLE, type AdminInquiryStatus, type WorkerInquiryKind } from "@/lib/worker-inquiries";

export interface WorkerInquiryPatch {
  adminStatus?: AdminInquiryStatus;
  adminNote?: string | null;
  forward?: true;
}

export type WorkerInquiryUpdateResult =
  | { ok: true; item: Record<string, unknown>; forwarded: boolean }
  | { ok: false; error: string; status: 404 | 409 | 503; requestId?: string };

/**
 * Admin xử lý một yêu cầu của công nhân: đổi trạng thái, ghi chú, hoặc chuyển cho đối tác (forward).
 * Quy tắc: yêu cầu đã chuyển thì Admin chỉ còn ghi chú (đối tác tự cập nhật trạng thái của họ);
 * yêu cầu đã đóng phải mở lại trước khi chuyển. Cập nhật có điều kiện theo nơi xử lý đã đọc nên hai Admin thao tác trùng thì người sau nhận 409.
 */
export async function updateWorkerInquiry(kind: WorkerInquiryKind, id: string, patch: WorkerInquiryPatch, adminId: string): Promise<WorkerInquiryUpdateResult> {
  const supabase = createSupabaseAdminClient();
  const table = WORKER_INQUIRY_TABLE[kind];
  const { data: row, error: readError } = await supabase.from(table).select("id,routed_to,admin_status").eq("id", id).maybeSingle();
  if (readError) {
    const requestId = logSafeSupabaseError({ route: "lib/admin-worker-inquiries", operation: "read_inquiry", error: readError });
    return { ok: false, error: "Chưa đọc được yêu cầu. Vui lòng thử lại.", status: 503, requestId };
  }
  if (!row) return { ok: false, error: "Không tìm thấy yêu cầu.", status: 404 };

  const alreadyForwarded = row.routed_to === "provider";
  if (patch.forward && alreadyForwarded) return { ok: false, error: "Yêu cầu đã được chuyển cho đối tác.", status: 409 };
  if (patch.adminStatus !== undefined && alreadyForwarded) return { ok: false, error: "Yêu cầu đã chuyển cho đối tác: trạng thái do đối tác cập nhật.", status: 409 };
  if (patch.forward && (patch.adminStatus ?? row.admin_status) === "closed") return { ok: false, error: "Yêu cầu đã đóng. Hãy mở lại trước khi chuyển cho đối tác.", status: 409 };

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };
  if (patch.adminNote !== undefined) update.admin_note = patch.adminNote || null;
  if (patch.adminStatus !== undefined) update.admin_status = patch.adminStatus;
  if (patch.forward) Object.assign(update, { routed_to: "provider", forwarded_at: now, forwarded_by: adminId });

  const { data: saved, error: writeError } = await supabase.from(table).update(update).eq("id", id).eq("routed_to", row.routed_to).select("id").maybeSingle();
  if (writeError) {
    const requestId = logSafeSupabaseError({ route: "lib/admin-worker-inquiries", operation: "update_inquiry", error: writeError });
    return { ok: false, error: "Chưa xác định yêu cầu đã được cập nhật hay chưa. Hãy tải lại trước khi thao tác tiếp.", status: 503, requestId };
  }
  if (!saved) return { ok: false, error: "Yêu cầu vừa được người khác xử lý. Hãy tải lại danh sách.", status: 409 };

  const { data: item, error: itemError } = await supabase.from("admin_worker_inquiries").select(WORKER_INQUIRY_FIELDS).eq("kind", kind).eq("id", id).maybeSingle();
  if (itemError || !item) {
    const requestId = itemError ? logSafeSupabaseError({ route: "lib/admin-worker-inquiries", operation: "read_saved_inquiry", error: itemError }) : undefined;
    return { ok: false, error: "Đã lưu nhưng chưa đọc lại được yêu cầu. Hãy tải lại danh sách.", status: 503, ...(requestId ? { requestId } : {}) };
  }
  return { ok: true, item: item as Record<string, unknown>, forwarded: Boolean(patch.forward) };
}
