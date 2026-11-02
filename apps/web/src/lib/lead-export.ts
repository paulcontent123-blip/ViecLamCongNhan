import type { SupabaseClient } from "@supabase/supabase-js";
import { isWorkerInquiryKind, parseWorkerInquiryFilters } from "@/lib/worker-inquiries";
import { provinceName } from "@/lib/provinces";
import { normalizePhone } from "@/lib/phone";

// Xuất danh sách liên hệ công nhân cho đối tác (Sản phẩm 3, chỉ Superadmin). Không import server-only để test được.
// Lọc theo bộ lọc của trang Yêu cầu dịch vụ công nhân; chỉ xuất bản ghi còn ở Admin và công nhân đã đồng ý chia sẻ.
// Không có bảng ghi lô: mỗi lần xuất chỉ được ghi vào admin_audit_log, nên không tự biết liên hệ nào đã giao cho đối tác nào.

/** Phiên bản văn bản đồng ý chia sẻ mà app đang hiển thị; ghi cùng bản ghi để biết công nhân đã đồng ý bản nào. */
export const LEAD_SHARE_CONSENT_VERSION = "2026-11-v1";

/** Cột ghi thêm khi công nhân tick đồng ý chia sẻ; không tick (hoặc app bản cũ không gửi) thì không ghi gì. */
export function shareConsentColumns(shareConsent: boolean | undefined, now: Date = new Date()) {
  return shareConsent === true ? { share_consent_at: now.toISOString(), share_consent_version: LEAD_SHARE_CONSENT_VERSION } : {};
}

export const FINANCE_CATEGORIES = ["ewa", "consumer_loan", "remittance"] as const;
export const FINANCE_CATEGORY_LABEL: Record<string, string> = { ewa: "Ứng lương", consumer_loan: "Vay tiêu dùng", remittance: "Chuyển tiền" };
export const LEAD_KIND_LABEL: Record<string, string> = {
  vocational_inquiry: "Học nghề · Hỏi khóa học",
  vocational_application: "Học nghề · Hồ sơ học viên",
  insurance_inquiry: "Bảo hiểm",
  finance_inquiry: "Tài chính",
};
export const LEAD_MAX_EXPORT = 1000;

const PROVINCE = /^[A-Za-z0-9_-]{1,32}$/;

/** Bộ lọc bổ sung cho xuất (chỉ Tài chính lưu nhóm nhu cầu và tỉnh/thành). Giá trị lạ ném RangeError. */
export function parseLeadExtras(params: URLSearchParams, kind: string) {
  const category = params.get("category") ?? "";
  const province = params.get("province") ?? "";
  if (category && !(FINANCE_CATEGORIES as readonly string[]).includes(category)) throw new RangeError("Nhóm nhu cầu không hợp lệ.");
  if (province && !PROVINCE.test(province)) throw new RangeError("Mã tỉnh/thành không hợp lệ.");
  if ((category || province) && kind && kind !== "finance_inquiry") throw new RangeError("Nhóm nhu cầu và tỉnh/thành chỉ áp dụng cho yêu cầu Tài chính.");
  return { category, province };
}

export const LEAD_EXPORT_FIELDS = "kind,id,full_name,phone,subject,extra,created_at";

/** Truy vấn các liên hệ đủ điều kiện xuất: còn ở Admin, đã đồng ý chia sẻ, và khớp bộ lọc kind/status/q (cùng cách lọc của trang). */
export function leadExportQuery(
  client: SupabaseClient,
  filters: ReturnType<typeof parseWorkerInquiryFilters>,
  extras: { category: string; province: string },
  options: { head?: boolean } = {},
) {
  let query = client.from("admin_worker_inquiries").select(LEAD_EXPORT_FIELDS, { count: "exact", head: options.head ?? false })
    .eq("routed_to", "admin").not("share_consent_at", "is", null);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.status) query = query.eq("admin_status", filters.status);
  if (filters.q) query = query.or(`full_name.ilike.%${filters.q}%,phone.ilike.%${filters.q}%,subject.ilike.%${filters.q}%,provider_name.ilike.%${filters.q}%`);
  if (extras.category) query = query.eq("kind", "finance_inquiry").eq("extra->>category", extras.category);
  if (extras.province) query = query.eq("kind", "finance_inquiry").eq("extra->>province_code", extras.province);
  return query;
}

/** Nguồn gợi ý cho ô "Đối tác nhận": đủ 5 loại đối tác có tài khoản và đối tác doanh thu. */
export const LEAD_PARTNER_SOURCES = [
  { table: "training_providers", column: "provider_name", label: "Học nghề" },
  { table: "rental_providers", column: "provider_name", label: "Thuê trọ" },
  { table: "insurance_providers", column: "provider_name", label: "Bảo hiểm" },
  { table: "finance_providers", column: "provider_name", label: "Tài chính" },
  { table: "health_providers", column: "provider_name", label: "Y tế" },
  { table: "revenue_partners", column: "partner_name", label: "Đối tác doanh thu" },
] as const;

export interface LeadPartnerOption { name: string; label: string }

/**
 * Tên các đối tác để gợi ý khi nhập "Đối tác nhận" (tối đa 300 mỗi loại). Gợi ý thôi: Admin vẫn gõ tên đơn vị khác.
 * Một loại đọc lỗi thì bỏ qua loại đó, không làm hỏng trang. Trùng tên (không phân biệt hoa thường) giữ bản đầu tiên.
 */
export async function loadLeadPartnerOptions(client: SupabaseClient): Promise<LeadPartnerOption[]> {
  const results = await Promise.all(LEAD_PARTNER_SOURCES.map(async (source) => {
    const { data, error } = await client.from(source.table).select(source.column).order(source.column, { ascending: true }).limit(300);
    if (error || !data) return [] as LeadPartnerOption[];
    return (data as unknown as Record<string, unknown>[])
      .map((row) => String(row[source.column] ?? "").trim())
      .filter((name) => name.length >= 2)
      .map((name) => ({ name, label: source.label }));
  }));
  const seen = new Set<string>();
  const options: LeadPartnerOption[] = [];
  for (const option of results.flat()) {
    const key = option.name.toLocaleLowerCase("vi");
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(option);
  }
  return options.sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export interface LeadRow {
  kind: string;
  id: string;
  full_name: string;
  phone: string;
  subject: string | null;
  extra: { category?: string; province_code?: string | null } | null;
  created_at: string;
}

/** Họ tên, số điện thoại, tỉnh, nhu cầu (không xuất lời nhắn, email hay ghi chú của Admin). */
export const LEAD_CSV_HEADER = ["Họ tên", "Số điện thoại", "Tỉnh/thành", "Loại nhu cầu", "Nhu cầu", "Ngày gửi"];

// Ô bắt đầu bằng = + - @ hoặc ký tự điều khiển sẽ bị Excel/Sheets hiểu là công thức; thêm dấu nháy đơn phía trước.
function csvCell(value: unknown): string {
  let text = String(value ?? "").replace(/\r?\n|\r/g, " ").trim();
  if (/^[=+\-@\t]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

// Hiển thị 0901 234 567 (có khoảng trắng) để Excel không coi là số và làm mất số 0 đầu.
export function formatLeadPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  return /^0\d{9}$/.test(normalized) ? `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}` : normalized;
}

export function leadCsvRow(row: LeadRow): string[] {
  const kind = isWorkerInquiryKind(row.kind) ? LEAD_KIND_LABEL[row.kind] : row.kind;
  const category = row.extra?.category ? FINANCE_CATEGORY_LABEL[row.extra.category] ?? row.extra.category : "";
  const province = row.extra?.province_code ? provinceName(row.extra.province_code) : "";
  return [row.full_name, formatLeadPhone(row.phone), province, category ? `${kind} · ${category}` : kind, row.subject ?? "", row.created_at.slice(0, 10)];
}

/** CSV UTF-8 có BOM để Excel đọc đúng tiếng Việt. */
export function buildLeadCsv(rows: LeadRow[]): string {
  return `﻿${[LEAD_CSV_HEADER, ...rows.map(leadCsvRow)].map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
