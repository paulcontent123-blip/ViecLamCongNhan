import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const MOBILE_ACCOUNT_ROLES = ["admin", "candidate", "employer", "agency", "training_provider", "rental_provider", "insurance_provider", "finance_provider", "health_provider"] as const;
export const MOBILE_ACCOUNT_FIELDS = "id,full_name,email,phone,role,admin_role,status,is_verified,created_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseAdminAccountFilters(params: URLSearchParams) {
  const role = params.get("role") || "";
  const adminRole = params.get("adminRole") || "";
  const status = params.get("status") || "";
  const rawQ = (params.get("q") || "").trim();
  if (rawQ.length > 100) throw new RangeError("Từ khóa tối đa 100 ký tự.");
  if (role && !(MOBILE_ACCOUNT_ROLES as readonly string[]).includes(role)) throw new RangeError("Vai trò không hợp lệ.");
  if (adminRole && !["editor", "superadmin"].includes(adminRole)) throw new RangeError("Cấp quyền Admin không hợp lệ.");
  if (adminRole && role && role !== "admin") throw new RangeError("Cấp quyền chỉ áp dụng cho Admin.");
  if (status && !["active", "deleted"].includes(status)) throw new RangeError("Trạng thái không hợp lệ.");
  // Loại ký tự điều khiển cú pháp PostgREST; giữ dấu chấm để tìm email.
  const q = rawQ.replace(/[(),%_*"\\]/g, " ").replace(/\s+/g, " ").trim();
  if (rawQ && !q) throw new RangeError("Vui lòng nhập tên, email hoặc số điện thoại.");
  return { role: role || (adminRole ? "admin" : ""), adminRole, status, q };
}

export function validAdminAccountId(id: string) { return UUID.test(id); }

// Bản tài khoản app đã đọc, gửi kèm thao tác ghi để máy chủ từ chối nếu tài khoản đã đổi (ACCOUNT_CHANGED).
export const accountExpectedSchema = z.object({
  full_name: z.string(), email: z.string().nullable(), phone: z.string().nullable(), role: z.string(),
  admin_role: z.enum(["editor", "superadmin"]).nullable(), status: z.enum(["active", "deleted"]),
}).strict();

// Chỉ trả thông tin nhận diện; không bao giờ trả hash mật khẩu hay dữ liệu phiên.
export function publicAdminAccount(row: Record<string, unknown>) {
  return Object.fromEntries(MOBILE_ACCOUNT_FIELDS.split(",").map(key => [key, row[key] ?? null]));
}

export function adminAccountListQuery(client: SupabaseClient, filters: ReturnType<typeof parseAdminAccountFilters>, offset: number, pageSize: number) {
  let query = client.from("users").select(MOBILE_ACCOUNT_FIELDS, { count: "exact" })
    .order("created_at", { ascending: false }).order("id", { ascending: false });
  if (filters.role) query = query.eq("role", filters.role);
  if (filters.adminRole) query = query.eq("admin_role", filters.adminRole);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.q) query = query.or(`full_name.ilike.%${filters.q}%,email.ilike.%${filters.q}%,phone.ilike.%${filters.q}%`);
  return query.range(offset, offset + pageSize - 1);
}
