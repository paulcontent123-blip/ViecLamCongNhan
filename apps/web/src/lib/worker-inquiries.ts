import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// Yêu cầu dịch vụ của công nhân đi về Admin trước (Ưu tiên 5). Không import server-only để test được ngoài Next.

export const WORKER_INQUIRY_KINDS = ["vocational_inquiry", "vocational_application", "insurance_inquiry", "finance_inquiry"] as const;
export type WorkerInquiryKind = (typeof WORKER_INQUIRY_KINDS)[number];

export const WORKER_INQUIRY_TABLE: Record<WorkerInquiryKind, string> = {
  vocational_inquiry: "vocational_inquiries",
  vocational_application: "vocational_applications",
  insurance_inquiry: "insurance_inquiries",
  finance_inquiry: "finance_inquiries",
};

// Hướng hiện tại: yêu cầu của công nhân chỉ do Admin xử lý, không chuyển cho đối tác.
// Mã chuyển đối tác vẫn còn nhưng tắt mặc định; bật lại bằng biến môi trường WORKER_INQUIRY_FORWARDING=on.
export function workerInquiryForwardingEnabled(): boolean {
  return process.env.WORKER_INQUIRY_FORWARDING === "on";
}
export const FORWARDING_DISABLED_MESSAGE = "Chức năng chuyển yêu cầu cho đối tác đang tắt. Yêu cầu của công nhân chỉ do Admin xử lý.";

export const ADMIN_INQUIRY_STATUSES = ["new", "contacted", "closed"] as const;
export type AdminInquiryStatus = (typeof ADMIN_INQUIRY_STATUSES)[number];

export const WORKER_INQUIRY_FIELDS = "kind,id,full_name,phone,email,message,subject,provider_name,extra,partner_status,routed_to,admin_status,admin_note,forwarded_at,created_at,updated_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isWorkerInquiryKind(value: string): value is WorkerInquiryKind {
  return (WORKER_INQUIRY_KINDS as readonly string[]).includes(value);
}
export function validWorkerInquiryId(id: string) { return UUID.test(id); }

/** Body PATCH: đổi trạng thái xử lý, ghi chú, và/hoặc chuyển cho đối tác (forward). Phải có ít nhất một trường. */
export const workerInquiryPatchSchema = z.object({
  adminStatus: z.enum(ADMIN_INQUIRY_STATUSES).optional(),
  adminNote: z.string().trim().max(1000).nullable().optional(),
  forward: z.literal(true).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "Không có trường cần cập nhật." });

/** routed: 'admin' = hàng đợi của Admin (mặc định), 'provider' = đã chuyển đối tác, 'all' = cả hai. */
export function parseWorkerInquiryFilters(params: URLSearchParams) {
  const kind = params.get("kind") || "";
  const routed = params.get("routed") || "admin";
  const status = params.get("status") || "";
  const id = params.get("id") || "";
  const rawQ = (params.get("q") || "").trim();
  if (kind && !isWorkerInquiryKind(kind)) throw new RangeError("Loại yêu cầu không hợp lệ.");
  if (!["admin", "provider", "all"].includes(routed)) throw new RangeError("Nơi xử lý không hợp lệ.");
  if (status && !(ADMIN_INQUIRY_STATUSES as readonly string[]).includes(status)) throw new RangeError("Trạng thái không hợp lệ.");
  if (id && !validWorkerInquiryId(id)) throw new RangeError("Mã yêu cầu không hợp lệ.");
  if (rawQ.length > 100) throw new RangeError("Từ khóa tối đa 100 ký tự.");
  // Loại ký tự điều khiển cú pháp PostgREST; giữ dấu chấm để tìm email.
  const q = rawQ.replace(/[(),%_*"\\]/g, " ").replace(/\s+/g, " ").trim();
  if (rawQ && !q) throw new RangeError("Vui lòng nhập tên, số điện thoại hoặc nội dung cần tìm.");
  return { kind, routed, status, id, q };
}

export function workerInquiryListQuery(client: SupabaseClient, filters: ReturnType<typeof parseWorkerInquiryFilters>, offset: number, pageSize: number) {
  let query = client.from("admin_worker_inquiries").select(WORKER_INQUIRY_FIELDS, { count: "exact" })
    .order("created_at", { ascending: false }).order("id", { ascending: false });
  if (filters.id) query = query.eq("id", filters.id);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.routed !== "all") query = query.eq("routed_to", filters.routed);
  // admin_status chỉ có nghĩa khi yêu cầu còn ở Admin; yêu cầu đã chuyển do đối tác cập nhật trạng thái riêng.
  if (filters.status) query = query.eq("admin_status", filters.status);
  if (filters.q) query = query.or(`full_name.ilike.%${filters.q}%,phone.ilike.%${filters.q}%,subject.ilike.%${filters.q}%,provider_name.ilike.%${filters.q}%`);
  return query.range(offset, offset + pageSize - 1);
}
