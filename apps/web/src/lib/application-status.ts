/**
 * Trạng thái của một đơn ứng tuyển vào một tin cụ thể.
 *
 * Đây là nguồn trạng thái chi tiết theo từng đơn. Database đồng bộ một trạng
 * thái tổng hợp sang `candidates.status` để Admin có thể nhìn nhanh; khi có
 * nhiều đơn, quy tắc ưu tiên nằm trong migration đồng bộ.
 */
export const APPLICATION_STATUSES = ["new", "viewed", "contacted", "rejected", "hired"] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  new: "Mới",
  viewed: "Đã xem",
  contacted: "Đã liên hệ",
  rejected: "Từ chối",
  hired: "Đã tuyển",
};

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(value);
}
