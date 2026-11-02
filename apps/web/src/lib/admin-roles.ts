// Cấp quyền Admin và các nhóm chức năng chỉ dành cho superadmin. Không import server-only để cả
// trang quản trị (client) lẫn máy chủ dùng chung; việc chặn thật nằm ở API (xem lib/admin-auth.ts).

export const ADMIN_ROLES = ["editor", "superadmin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * Nhóm chức năng cần superadmin:
 * - payments: đơn hàng, xác nhận thanh toán, tài khoản VietQR, ví MoMo, số liệu doanh thu.
 * - partners: xác minh và duyệt 5 loại đối tác (đào tạo, thuê trọ, bảo hiểm, tài chính, y tế) và đối tác doanh thu.
 * - admin_users: tạo, sửa, xóa người dùng và Admin, đặt lại mật khẩu.
 * - cash_rewards: cài đặt và giới hạn quà tiền mặt, tạo và sửa quà tiền mặt, xử lý yêu cầu đổi tiền mặt.
 * Editor làm phần còn lại (nội dung, tuyển dụng, duyệt tin Chợ, quà thẻ và hiện vật...).
 */
export const ADMIN_CAPABILITIES = ["payments", "partners", "admin_users", "cash_rewards"] as const;
export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  editor: "Biên tập",
  superadmin: "Superadmin",
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function adminCan(role: AdminRole, capability: AdminCapability): boolean {
  return role === "superadmin" && (ADMIN_CAPABILITIES as readonly string[]).includes(capability);
}

export function adminCapabilities(role: AdminRole): AdminCapability[] {
  return ADMIN_CAPABILITIES.filter((capability) => adminCan(role, capability));
}
