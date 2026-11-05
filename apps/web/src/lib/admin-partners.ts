// Cấu hình 5 loại đối tác cho khu Quản trị trên web: xác minh đối tác và duyệt nội dung họ đăng.
//
// Năm loại đi qua năm cặp route riêng của `api/mobile/admin/*`, và các route đó KHÔNG giống nhau hoàn toàn:
// tên trường khác nhau, có loại đòi mốc phiên bản để chống sửa đè, có loại duyệt thêm bảng giá. Thay vì
// viết năm màn gần giống nhau, phần khác biệt được mô tả ở đây và dùng chung một giao diện.
//
// BẢN SAO HỢP ĐỒNG API: danh sách trạng thái và hình dạng body PATCH phải khớp `route.ts` tương ứng, nếu
// không máy chủ trả 400. Test ở `scripts/test-admin-partners.mjs` đọc thẳng mã nguồn route để kiểm tra.
//
// Tệp thuần dữ liệu và hàm thuần, không import gì, nên test chạy trực tiếp bằng node.

export const PARTNER_KINDS = ["training", "rental", "insurance", "finance", "health"] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];

// ───────── Xác minh đối tác ─────────

/**
 * Hình dạng body PATCH khi cập nhật một đối tác:
 * - `verified`: chỉ `{ verified }` (đào tạo, thuê trọ).
 * - `verifiedOrLimit`: `{ verified?, contactViewLimit? }`, phải có ít nhất một (bảo hiểm, tài chính).
 * - `health`: `{ isVerified, contactViewLimit, expectedUpdatedAt }`, bắt buộc cả ba và tên trường khác hẳn.
 */
export type ProviderPatchShape = "verified" | "verifiedOrLimit" | "health";

export type PartnerProviderConfig = {
  kind: PartnerKind;
  /** Tên khu dịch vụ, dùng cho tab. */
  label: string;
  /** Gọi đối tác là gì trong khu này. */
  providerLabel: string;
  icon: string;
  /** Đường dẫn dưới `api/mobile/`. */
  path: string;
  patchShape: ProviderPatchShape;
  /** Khu có hạn mức xem liên hệ do Admin cấp hay không. */
  hasContactLimit: boolean;
  /**
   * Máy chủ CHẶN xác minh khi đối tác chưa khai số giấy phép và hồ sơ giấy phép (trả 400).
   * Giao diện báo trước và khoá nút, để Admin không bấm vào chỗ chắc chắn hỏng.
   */
  requiresLicenseToVerify: boolean;
  /**
   * Đường dẫn lấy liên kết có chữ ký cho hồ sơ giấy phép lưu ở kho riêng (`private-storage:...`).
   * Chỉ khu Tài chính có; các khu khác lưu liên kết https công khai nên mở thẳng được. `{id}` là mã đối tác.
   */
  evidenceSignedUrlPath: string | null;
};

export const PARTNER_PROVIDERS: Record<PartnerKind, PartnerProviderConfig> = {
  training: {
    kind: "training",
    label: "Học nghề",
    providerLabel: "Đơn vị đào tạo",
    icon: "🎓",
    path: "admin/training-providers",
    patchShape: "verified",
    hasContactLimit: false,
    requiresLicenseToVerify: false,
    evidenceSignedUrlPath: null,
  },
  rental: {
    kind: "rental",
    label: "Thuê trọ",
    providerLabel: "Chủ trọ",
    icon: "🏠",
    path: "admin/rental-providers",
    patchShape: "verified",
    hasContactLimit: false,
    requiresLicenseToVerify: false,
    evidenceSignedUrlPath: null,
  },
  insurance: {
    kind: "insurance",
    label: "Bảo hiểm",
    providerLabel: "Đơn vị bảo hiểm",
    icon: "🛡️",
    path: "admin/insurance-providers",
    patchShape: "verifiedOrLimit",
    hasContactLimit: true,
    requiresLicenseToVerify: false,
    evidenceSignedUrlPath: null,
  },
  finance: {
    kind: "finance",
    label: "Tài chính",
    providerLabel: "Đơn vị tài chính",
    icon: "💳",
    path: "admin/finance-providers",
    patchShape: "verifiedOrLimit",
    hasContactLimit: true,
    requiresLicenseToVerify: true,
    evidenceSignedUrlPath: "admin/finance-providers/{id}/license-evidence",
  },
  health: {
    kind: "health",
    label: "Y tế",
    providerLabel: "Cơ sở y tế",
    icon: "🏥",
    path: "admin/health-providers",
    patchShape: "health",
    hasContactLimit: true,
    requiresLicenseToVerify: true,
    evidenceSignedUrlPath: null,
  },
};

/**
 * Nhãn loại hình đối tác. Mã lấy từ `providerType` trong các route đăng ký đối tác; chữ tiếng Việt lấy đúng
 * như app đang hiện ở màn đăng ký, để Admin và đối tác gọi cùng một tên.
 * `training_center` là giá trị mặc định của cơ sở dữ liệu (route đăng ký đơn vị đào tạo không nhận trường này).
 */
export const PROVIDER_TYPE_LABEL: Record<string, string> = {
  individual: "Cá nhân",
  business: "Đơn vị",
  training_center: "Trung tâm đào tạo",
  insurance_company: "Doanh nghiệp bảo hiểm",
  licensed_agent: "Đại lý được ủy quyền",
  public_program: "Chương trình công",
  bank: "Ngân hàng",
  finance_company: "Công ty tài chính",
  remittance_provider: "Đơn vị chuyển tiền",
  other: "Đơn vị khác",
  clinic: "Phòng khám",
  hospital: "Bệnh viện",
  medical_center: "Trung tâm y tế",
};

/** Mã lạ (route thêm loại mới mà chưa cập nhật nhãn) thì hiện nguyên mã, đừng nuốt mất thông tin. */
export function providerTypeLabel(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  return PROVIDER_TYPE_LABEL[raw] ?? raw;
}

export type ProviderPatchInput = {
  verified?: boolean;
  contactViewLimit?: number;
  /** Mốc `updated_at` đọc được lúc tải danh sách; chỉ khu Y tế bắt buộc. */
  expectedUpdatedAt?: string | null;
};

/**
 * Dựng body PATCH đúng hình dạng route của từng khu.
 * Ném lỗi khi thiếu trường bắt buộc, để giao diện báo ngay thay vì để máy chủ trả 400 khó hiểu.
 */
export function providerPatchBody(
  config: PartnerProviderConfig,
  input: ProviderPatchInput,
): Record<string, unknown> {
  if (config.patchShape === "verified") {
    if (typeof input.verified !== "boolean") throw new Error("Thiếu trạng thái xác minh.");
    return { verified: input.verified };
  }

  if (config.patchShape === "verifiedOrLimit") {
    const body: Record<string, unknown> = {};
    if (typeof input.verified === "boolean") body.verified = input.verified;
    if (typeof input.contactViewLimit === "number") body.contactViewLimit = input.contactViewLimit;
    if (Object.keys(body).length === 0) throw new Error("Không có thay đổi nào để lưu.");
    return body;
  }

  // Khu Y tế: máy chủ đòi đủ cả ba trường và dùng tên `isVerified`.
  if (typeof input.verified !== "boolean") throw new Error("Thiếu trạng thái xác minh.");
  if (typeof input.contactViewLimit !== "number") throw new Error("Thiếu hạn mức xem liên hệ.");
  if (!input.expectedUpdatedAt) throw new Error("Thiếu mốc phiên bản. Hãy tải lại danh sách rồi thử lại.");
  return {
    isVerified: input.verified,
    contactViewLimit: input.contactViewLimit,
    expectedUpdatedAt: input.expectedUpdatedAt,
  };
}

// ───────── Duyệt nội dung đối tác ─────────

export type PartnerContentConfig = {
  kind: PartnerKind;
  /** Tên loại nội dung, dùng cho tab và tiêu đề. */
  label: string;
  /** Đơn vị đếm: "3 khóa học", "5 tin". */
  unit: string;
  icon: string;
  path: string;
  /** Trạng thái lọc được, phải khớp danh sách route chấp nhận. */
  statuses: readonly string[];
  /** Route đòi `expectedUpdatedAt` để chống hai Admin duyệt đè lên nhau. */
  needsExpectedUpdatedAt: boolean;
  /** Chỉ Tài chính: duyệt riêng phần phí/lãi trước khi hiện ra ngoài. */
  hasPricingApproval: boolean;
  /** Tên đối tác nằm phẳng (`provider_name`) hay lồng (`provider.provider_name`) trong phản hồi. */
  providerShape: "flat" | "nested";
};

export const PARTNER_CONTENTS: Record<PartnerKind, PartnerContentConfig> = {
  training: {
    kind: "training",
    label: "Khóa học nghề",
    unit: "khóa học",
    icon: "🎓",
    path: "admin/vocational-courses",
    statuses: ["draft", "pending", "approved", "rejected", "hidden", "closed"],
    needsExpectedUpdatedAt: false,
    hasPricingApproval: false,
    providerShape: "flat",
  },
  rental: {
    kind: "rental",
    label: "Tin cho thuê",
    unit: "tin",
    icon: "🏠",
    path: "admin/rental-listings",
    statuses: ["draft", "pending", "approved", "rejected", "hidden", "full"],
    needsExpectedUpdatedAt: false,
    hasPricingApproval: false,
    providerShape: "flat",
  },
  insurance: {
    kind: "insurance",
    label: "Sản phẩm bảo hiểm",
    unit: "sản phẩm",
    icon: "🛡️",
    path: "admin/insurance-products",
    statuses: ["draft", "pending", "approved", "rejected", "hidden"],
    needsExpectedUpdatedAt: false,
    hasPricingApproval: false,
    providerShape: "nested",
  },
  finance: {
    kind: "finance",
    label: "Sản phẩm tài chính",
    unit: "sản phẩm",
    icon: "💳",
    path: "admin/finance-products",
    statuses: ["draft", "pending", "approved", "rejected", "hidden"],
    needsExpectedUpdatedAt: true,
    hasPricingApproval: true,
    providerShape: "nested",
  },
  health: {
    kind: "health",
    label: "Dịch vụ y tế",
    unit: "dịch vụ",
    icon: "🏥",
    path: "admin/health-services",
    statuses: ["draft", "pending", "approved", "rejected", "hidden"],
    needsExpectedUpdatedAt: true,
    hasPricingApproval: false,
    providerShape: "nested",
  },
};

/** Ba thao tác duyệt mà mọi khu đều có. */
export const CONTENT_DECISIONS = ["approved", "rejected", "hidden"] as const;
export type ContentDecision = (typeof CONTENT_DECISIONS)[number];

export const CONTENT_STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  hidden: "Đã ẩn",
  closed: "Đã đóng",
  full: "Đã đầy",
};

export type StatusTone = "amber" | "green" | "red" | "gray" | "blue";

export const CONTENT_STATUS_TONE: Record<string, StatusTone> = {
  draft: "gray",
  pending: "amber",
  approved: "green",
  rejected: "red",
  hidden: "gray",
  closed: "gray",
  full: "blue",
};

export type ContentPatchInput = {
  status: ContentDecision;
  rejectionReason?: string;
  expectedUpdatedAt?: string | null;
  /** Chỉ Tài chính: có duyệt kèm phần phí/lãi hay không. */
  pricingApproved?: boolean;
};

/** Lý do từ chối tối thiểu 3 ký tự ở phía máy chủ (bảo hiểm, tài chính, y tế, chợ). Kiểm tra sớm cho rõ. */
export const REJECTION_REASON_MIN = 3;

export function contentPatchBody(
  config: PartnerContentConfig,
  input: ContentPatchInput,
): Record<string, unknown> {
  const reason = (input.rejectionReason ?? "").trim();
  if (input.status === "rejected" && reason.length < REJECTION_REASON_MIN) {
    throw new Error(`Khi từ chối phải ghi lý do, tối thiểu ${REJECTION_REASON_MIN} ký tự.`);
  }

  const body: Record<string, unknown> = { status: input.status };
  if (input.status === "rejected") body.rejectionReason = reason;

  if (config.needsExpectedUpdatedAt) {
    if (!input.expectedUpdatedAt) {
      throw new Error("Thiếu mốc phiên bản. Hãy tải lại danh sách rồi thử lại.");
    }
    body.expectedUpdatedAt = input.expectedUpdatedAt;
  }

  if (config.hasPricingApproval && typeof input.pricingApproved === "boolean") {
    body.pricingApproved = input.pricingApproved;
  }

  return body;
}

/** Đọc tên và trạng thái xác minh của đối tác, che đi khác biệt phẳng/lồng giữa các route. */
export function contentProviderOf(
  config: PartnerContentConfig,
  item: Record<string, unknown>,
): { name: string | null; verified: boolean } {
  if (config.providerShape === "flat") {
    return {
      name: typeof item.provider_name === "string" ? item.provider_name : null,
      verified: item.provider_verified === true,
    };
  }
  const provider = item.provider as { provider_name?: unknown; is_verified?: unknown } | null | undefined;
  return {
    name: provider && typeof provider.provider_name === "string" ? provider.provider_name : null,
    verified: provider?.is_verified === true,
  };
}
