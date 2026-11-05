// Hằng số và hàm dựng dữ liệu cho cổng tự phục vụ của Cơ sở y tế trên web.
//
// BẢN SAO QUY TẮC: nhãn trạng thái lấy đúng như app đang hiện (`screens/partner/HealthProvider*.js`), còn hình
// dạng body gửi lên phải khớp schema của `api/mobile/health-provider/*` và `api/health-providers`.
// Đổi một bên thì đổi cả hai.
//
// Tệp thuần dữ liệu và hàm thuần, không import gì, nên chạy trực tiếp bằng node được.

export type StatusTone = "amber" | "green" | "red" | "gray" | "blue";

// ───────── Dịch vụ y tế ─────────

/** Trạng thái lọc được ở `api/mobile/health-provider/services`. */
export const SERVICE_STATUSES = ["draft", "pending", "approved", "rejected", "hidden"] as const;

/** Nhãn đúng như app: "approved" nói rõ là đang công khai. */
export const SERVICE_STATUS_LABEL: Record<string, string> = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  approved: "Đang công khai",
  rejected: "Bị từ chối",
  hidden: "Đã ẩn",
};

export const SERVICE_STATUS_TONE: Record<string, StatusTone> = {
  draft: "gray",
  pending: "amber",
  approved: "green",
  rejected: "red",
  hidden: "gray",
};

/** Bộ lọc hiện trên màn danh sách, giống app (không có "Đã ẩn": dịch vụ ẩn đã lưu trữ nên không còn trả về). */
export const SERVICE_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "draft", label: "Bản nháp" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Từ chối" },
];

export const HEALTH_CATEGORY_OPTIONS = [
  { value: "consultation", label: "Tư vấn" },
  { value: "examination", label: "Khám bệnh" },
  { value: "screening", label: "Sàng lọc sức khỏe" },
];

export type ServiceFormValues = {
  category: string;
  title: string;
  specialty: string;
  description: string;
  priceLabel: string;
  address: string;
  provinceCode: string;
  openingHours: string;
  acceptsBhyt: boolean;
};

export const EMPTY_SERVICE_FORM: ServiceFormValues = {
  category: "consultation",
  title: "",
  specialty: "",
  description: "",
  priceLabel: "",
  address: "",
  provinceCode: "",
  openingHours: "",
  acceptsBhyt: false,
};

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Đổi một dịch vụ đọc từ máy chủ về dạng form để sửa. */
export function serviceToForm(service: Record<string, unknown>): ServiceFormValues {
  const category = text(service.category);
  return {
    category: HEALTH_CATEGORY_OPTIONS.some((option) => option.value === category) ? category : "consultation",
    title: text(service.title),
    specialty: text(service.specialty),
    description: text(service.description),
    priceLabel: text(service.price_label),
    address: text(service.address),
    provinceCode: text(service.province_code),
    openingHours: text(service.opening_hours),
    acceptsBhyt: service.accepts_bhyt === true,
  };
}

/** Kiểm tra ở trình duyệt để báo lỗi sớm; máy chủ vẫn là nơi quyết định. Trả null khi hợp lệ. */
export function validateServiceForm(values: ServiceFormValues): string | null {
  if (values.title.trim().length < 3) return "Nhập tên dịch vụ từ 3 ký tự.";
  if (values.description.trim().length < 20) return "Mô tả dịch vụ cần ít nhất 20 ký tự.";
  if (!HEALTH_CATEGORY_OPTIONS.some((option) => option.value === values.category)) return "Chọn loại dịch vụ.";
  return null;
}

/**
 * Dựng body gửi lên `services` (POST) hoặc `services/[id]` (PATCH).
 *
 * `submitForReview` là công tắc duy nhất giữa "lưu nháp" và "gửi Admin duyệt". Trường trống gửi chuỗi rỗng chứ
 * không bỏ hẳn, đúng cách app làm: máy chủ coi chuỗi rỗng là null.
 * Lưu ý máy chủ: sửa một dịch vụ ĐÃ DUYỆT sẽ tự đưa về "chờ duyệt" dù submitForReview là false.
 */
export function serviceBody(values: ServiceFormValues, submitForReview: boolean): Record<string, unknown> {
  return {
    category: values.category,
    title: values.title.trim(),
    specialty: values.specialty.trim(),
    description: values.description.trim(),
    priceLabel: values.priceLabel.trim(),
    address: values.address.trim(),
    provinceCode: values.provinceCode.trim(),
    openingHours: values.openingHours.trim(),
    acceptsBhyt: values.acceptsBhyt,
    submitForReview,
  };
}

// ───────── Yêu cầu liên hệ ─────────

/** Trạng thái lọc được ở `api/mobile/health-provider/inquiries`. */
export const INQUIRY_STATUSES = ["new", "contacted", "appointment_confirmed", "completed", "cancelled"] as const;

export const INQUIRY_STATUS_LABEL: Record<string, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  appointment_confirmed: "Đã hẹn",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
};

export const INQUIRY_STATUS_TONE: Record<string, StatusTone> = {
  new: "amber",
  contacted: "blue",
  appointment_confirmed: "green",
  completed: "green",
  cancelled: "red",
};

export const INQUIRY_FILTERS = [
  { value: "", label: "Tất cả" },
  ...INQUIRY_STATUSES.map((value) => ({ value, label: INQUIRY_STATUS_LABEL[value] })),
];

/**
 * Các bước cơ sở được đổi sang. KHÔNG có "new": máy chủ không cho quay về trạng thái mới
 * (schema của `inquiries/[id]` chỉ nhận bốn giá trị còn lại).
 */
export const INQUIRY_TRANSITIONS = ["contacted", "appointment_confirmed", "completed", "cancelled"] as const;

// ───────── Hồ sơ cơ sở ─────────

export const HEALTH_PROVIDER_TYPES = [
  { value: "clinic", label: "Phòng khám" },
  { value: "hospital", label: "Bệnh viện" },
  { value: "medical_center", label: "Trung tâm y tế" },
];

export type ProfileFormValues = {
  providerName: string;
  providerType: string;
  contactName: string;
  contactPhone: string;
  provinceCode: string;
  address: string;
  taxCode: string;
  licenseNumber: string;
  licenseEvidenceUrl: string;
  description: string;
};

/** Máy chủ chỉ nhận liên kết hồ sơ chứng minh dùng HTTPS (hoặc để trống). */
export function evidenceUrlError(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (!raw.startsWith("https://")) return "URL hồ sơ chứng minh phải dùng HTTPS.";
  try {
    new URL(raw);
  } catch {
    return "URL hồ sơ chứng minh chưa hợp lệ.";
  }
  return null;
}

export function validateProfileForm(values: ProfileFormValues): string | null {
  if (values.providerName.trim().length < 2) return "Vui lòng nhập tên cơ sở.";
  if (values.contactName.trim().length < 2) return "Vui lòng nhập người phụ trách.";
  if (values.contactPhone.replace(/\D/g, "").length < 9) return "Số điện thoại không hợp lệ.";
  if (!HEALTH_PROVIDER_TYPES.some((option) => option.value === values.providerType)) return "Chọn loại cơ sở.";
  return evidenceUrlError(values.licenseEvidenceUrl);
}

export function profileBody(values: ProfileFormValues): Record<string, unknown> {
  return {
    providerName: values.providerName.trim(),
    providerType: values.providerType,
    contactName: values.contactName.trim(),
    contactPhone: values.contactPhone.trim(),
    provinceCode: values.provinceCode.trim(),
    address: values.address.trim(),
    taxCode: values.taxCode.trim(),
    licenseNumber: values.licenseNumber.trim(),
    licenseEvidenceUrl: values.licenseEvidenceUrl.trim(),
    description: values.description.trim(),
  };
}

export function profileToForm(profile: Record<string, unknown>): ProfileFormValues {
  const type = text(profile.provider_type);
  return {
    providerName: text(profile.provider_name),
    providerType: HEALTH_PROVIDER_TYPES.some((option) => option.value === type) ? type : "clinic",
    contactName: text(profile.contact_name),
    contactPhone: text(profile.contact_phone),
    provinceCode: text(profile.province_code),
    address: text(profile.address),
    taxCode: text(profile.tax_code),
    licenseNumber: text(profile.license_number),
    licenseEvidenceUrl: text(profile.license_evidence_url),
    description: text(profile.description),
  };
}

/**
 * So khớp hồ sơ đọc lại với nội dung vừa gửi.
 *
 * PATCH hồ sơ chỉ trả `{ ok, profile: { is_verified, updated_at } }` chứ không trả lại hồ sơ, nên sau khi ghi
 * phải đọc lại và đối chiếu từng trường mới dám báo "đã lưu" ‑ đúng cách app làm.
 */
export function profileMatches(saved: Record<string, unknown> | null, values: ProfileFormValues): boolean {
  if (!saved) return false;
  const now = profileToForm(saved);
  return (Object.keys(now) as (keyof ProfileFormValues)[]).every((key) => now[key] === values[key].trim());
}

// ───────── Đăng ký ─────────

export type RegisterFormValues = {
  providerName: string;
  providerType: string;
  contactName: string;
  contactPhone: string;
  email: string;
  password: string;
  provinceCode: string;
  address: string;
  taxCode: string;
  licenseNumber: string;
  licenseEvidenceUrl: string;
};

export function validateRegisterForm(values: RegisterFormValues): string | null {
  if (values.providerName.trim().length < 2) return "Nhập tên cơ sở y tế.";
  if (values.contactName.trim().length < 2) return "Nhập tên người phụ trách.";
  if (values.contactPhone.replace(/\D/g, "").length < 9) return "Số điện thoại liên hệ không hợp lệ.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return "Email đăng nhập chưa đúng định dạng.";
  if (values.password.length < 8) return "Mật khẩu tối thiểu 8 ký tự.";
  return evidenceUrlError(values.licenseEvidenceUrl);
}

export function registerBody(values: RegisterFormValues): Record<string, unknown> {
  return {
    providerName: values.providerName.trim(),
    providerType: values.providerType,
    contactName: values.contactName.trim(),
    contactPhone: values.contactPhone.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
    provinceCode: values.provinceCode.trim(),
    address: values.address.trim(),
    taxCode: values.taxCode.trim(),
    licenseNumber: values.licenseNumber.trim(),
    licenseEvidenceUrl: values.licenseEvidenceUrl.trim(),
  };
}

// ───────── Dịch vụ đã đặt (chỉ xem) ─────────

/** Loại yêu cầu khách đã gửi cho bộ phận kinh doanh; cùng nguồn `service_inquiries` với nhà tuyển dụng. */
export const BOOKED_TYPE_LABEL: Record<string, string> = {
  "Dịch vụ trọn gói": "Dịch vụ trọn gói",
  "Quảng cáo/Hợp tác": "Quảng cáo theo KCN",
  "Đối tác dịch vụ": "Đối tác dịch vụ",
  "Bảng giá quảng cáo": "Bảng giá quảng cáo",
};

export const BOOKED_STATUS_LABEL: Record<string, string> = {
  new: "Chưa tư vấn",
  consulted: "Đã tư vấn",
  cancelled: "Đã hủy đăng ký",
};

export const BOOKED_STATUS_TONE: Record<string, StatusTone> = {
  new: "amber",
  consulted: "green",
  cancelled: "red",
};
