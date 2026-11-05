// Hằng số và hàm dựng dữ liệu cho cổng tự phục vụ của Đơn vị đào tạo trên web.
//
// BẢN SAO QUY TẮC: nhãn trạng thái lấy đúng như app đang hiện (`screens/partner/TrainingProvider*.js`),
// còn hình dạng body gửi lên phải khớp schema của `api/mobile/training-provider/*`. Đổi một bên thì đổi cả
// hai, và test `scripts/test-training-provider-portal.mjs` đọc thẳng mã nguồn route để bắt lệch.
//
// Tệp thuần dữ liệu và hàm thuần, không import gì, nên test chạy trực tiếp bằng node.

// ───────── Trạng thái khóa học ─────────

/** Trạng thái lọc được ở `api/mobile/training-provider/courses`. */
export const COURSE_STATUSES = ["draft", "pending", "approved", "rejected", "hidden", "closed"] as const;

/** Nhãn đúng như app: "approved" nói rõ là đang nhận yêu cầu, "rejected" nói rõ là cần sửa. */
export const COURSE_STATUS_LABEL: Record<string, string> = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  approved: "Đang nhận yêu cầu",
  rejected: "Cần chỉnh sửa",
  hidden: "Đã ẩn",
  closed: "Đã đóng",
};

export type StatusTone = "amber" | "green" | "red" | "gray" | "blue";

export const COURSE_STATUS_TONE: Record<string, StatusTone> = {
  draft: "gray",
  pending: "amber",
  approved: "green",
  rejected: "red",
  hidden: "gray",
  closed: "gray",
};

/** Bộ lọc hiện trên màn danh sách khóa học, giống app (không có Nháp và Đã ẩn). */
export const COURSE_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Từ chối" },
  { value: "closed", label: "Đã đóng" },
];

// ───────── Trạng thái yêu cầu tư vấn ─────────

export const INQUIRY_STATUSES = ["new", "contacted", "advising", "registered", "closed", "cancelled"] as const;

export const INQUIRY_STATUS_LABEL: Record<string, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  advising: "Đang tư vấn",
  registered: "Đã ghi danh",
  closed: "Đã đóng",
  cancelled: "Đã hủy",
};

export const INQUIRY_STATUS_TONE: Record<string, StatusTone> = {
  new: "amber",
  contacted: "blue",
  advising: "blue",
  registered: "green",
  closed: "gray",
  cancelled: "red",
};

/** Thao tác đổi trạng thái hiện trên thẻ yêu cầu, theo thứ tự app bày. */
export const INQUIRY_ACTIONS = ["contacted", "advising", "registered"] as const;

// ───────── Trạng thái hồ sơ học viên ─────────

export const APPLICATION_STATUSES = ["new", "viewed", "contacted", "accepted", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  new: "Mới",
  viewed: "Đã xem",
  contacted: "Đã liên hệ",
  accepted: "Đã tiếp nhận",
  rejected: "Từ chối",
};

export const APPLICATION_STATUS_TONE: Record<string, StatusTone> = {
  new: "amber",
  viewed: "blue",
  contacted: "blue",
  accepted: "green",
  rejected: "red",
};

// ───────── Hình thức học ─────────

export const LEARNING_MODES = ["onsite", "online", "hybrid"] as const;
export type LearningMode = (typeof LEARNING_MODES)[number];

export const LEARNING_MODE_LABEL: Record<LearningMode, string> = {
  onsite: "Trực tiếp",
  online: "Trực tuyến",
  hybrid: "Kết hợp",
};

/** Cấp độ gợi ý, đúng ba mức app cho chọn. Máy chủ nhận chuỗi tự do tối đa 40 ký tự. */
export const COURSE_LEVELS = ["Cơ bản", "Trung cấp", "Nâng cao"] as const;

// ───────── Form khóa học ─────────

/** Giá trị form, tất cả để dạng chuỗi cho khớp ô nhập; chuyển kiểu khi dựng body. */
export type CourseFormValues = {
  title: string;
  occupation: string;
  level: string;
  description: string;
  requirements: string;
  learningMode: string;
  provinceCode: string;
  location: string;
  startDate: string;
  durationText: string;
  tuitionVnd: string;
  supportDescription: string;
  certificateName: string;
  certificateIssuer: string;
  capacity: string;
  enrollmentDeadline: string;
};

export const EMPTY_COURSE_FORM: CourseFormValues = {
  title: "",
  occupation: "",
  level: "",
  description: "",
  requirements: "",
  learningMode: "onsite",
  provinceCode: "",
  location: "",
  startDate: "",
  durationText: "",
  tuitionVnd: "",
  supportDescription: "",
  certificateName: "",
  certificateIssuer: "",
  capacity: "",
  enrollmentDeadline: "",
};

/** Đổi một khóa học đọc từ máy chủ về dạng form để sửa. */
export function courseToForm(course: Record<string, unknown>): CourseFormValues {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const number = (value: unknown) => (typeof value === "number" ? String(value) : "");
  const mode = text(course.learning_mode);
  return {
    title: text(course.title),
    occupation: text(course.occupation),
    level: text(course.level),
    description: text(course.description),
    requirements: text(course.requirements),
    learningMode: (LEARNING_MODES as readonly string[]).includes(mode) ? mode : "onsite",
    provinceCode: text(course.province_code),
    location: text(course.location),
    startDate: text(course.start_date),
    durationText: text(course.duration_text),
    tuitionVnd: number(course.tuition_vnd),
    supportDescription: text(course.support_description),
    certificateName: text(course.certificate_name),
    certificateIssuer: text(course.certificate_issuer),
    capacity: number(course.capacity),
    enrollmentDeadline: text(course.enrollment_deadline),
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Kiểm tra ở trình duyệt để báo lỗi sớm; máy chủ vẫn là nơi quyết định. Trả null khi hợp lệ. */
export function validateCourseForm(values: CourseFormValues): string | null {
  if (values.title.trim().length < 3) return "Nhập tên khóa học từ 3 ký tự.";
  if (values.occupation.trim().length < 2) return "Nhập nghề hoặc kỹ năng đào tạo.";
  if (values.description.trim().length < 20) return "Mô tả khóa học cần ít nhất 20 ký tự.";
  if (!(LEARNING_MODES as readonly string[]).includes(values.learningMode)) return "Chọn hình thức học.";
  for (const [key, label] of [
    ["tuitionVnd", "Học phí"],
    ["capacity", "Số chỗ"],
  ] as const) {
    const raw = values[key].trim();
    if (!raw) continue;
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed < 0) return `${label} phải là số nguyên không âm.`;
  }
  for (const [key, label] of [
    ["startDate", "Ngày khai giảng"],
    ["enrollmentDeadline", "Hạn nhận yêu cầu"],
  ] as const) {
    const raw = values[key].trim();
    if (raw && !DATE.test(raw)) return `${label} chưa đúng định dạng ngày.`;
  }
  return null;
}

/** Thao tác khi lưu khóa học. `submit` gửi Admin duyệt, `save` giữ nháp, `close` ngừng nhận yêu cầu. */
export const COURSE_ACTIONS = ["save", "submit", "close"] as const;
export type CourseAction = (typeof COURSE_ACTIONS)[number];

/**
 * Dựng body gửi lên `courses` (POST) hoặc `courses/[id]` (PATCH).
 *
 * Trường trống gửi chuỗi rỗng chứ không bỏ hẳn, đúng cách app làm: máy chủ coi chuỗi rỗng là null.
 * `tuitionVnd` và `capacity` gửi số hoặc null ‑ KHÔNG gửi chuỗi, vì schema đòi số nguyên.
 * `action` chỉ có ở PATCH; POST luôn vào thẳng trạng thái chờ duyệt.
 */
export function courseBody(values: CourseFormValues, action?: CourseAction): Record<string, unknown> {
  const numberOrNull = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  };

  const body: Record<string, unknown> = {
    title: values.title.trim(),
    occupation: values.occupation.trim(),
    level: values.level.trim(),
    description: values.description.trim(),
    requirements: values.requirements.trim(),
    learningMode: values.learningMode,
    provinceCode: values.provinceCode.trim(),
    location: values.location.trim(),
    startDate: values.startDate.trim(),
    durationText: values.durationText.trim(),
    tuitionVnd: numberOrNull(values.tuitionVnd),
    supportDescription: values.supportDescription.trim(),
    certificateName: values.certificateName.trim(),
    certificateIssuer: values.certificateIssuer.trim(),
    capacity: numberOrNull(values.capacity),
    enrollmentDeadline: values.enrollmentDeadline.trim(),
  };
  if (action) body.action = action;
  return body;
}

// ───────── Hồ sơ đơn vị ─────────

export type ProfileFormValues = {
  providerName: string;
  contactName: string;
  contactPhone: string;
  provinceCode: string;
  taxCode: string;
  licenseNumber: string;
  description: string;
};

export function validateProfileForm(values: ProfileFormValues): string | null {
  if (values.providerName.trim().length < 2) return "Vui lòng nhập tên đơn vị.";
  if (values.contactName.trim().length < 2) return "Vui lòng nhập người phụ trách.";
  if (values.contactPhone.replace(/\D/g, "").length < 9) return "Số điện thoại không hợp lệ.";
  return null;
}

export function profileBody(values: ProfileFormValues): Record<string, unknown> {
  return {
    providerName: values.providerName.trim(),
    contactName: values.contactName.trim(),
    contactPhone: values.contactPhone.trim(),
    provinceCode: values.provinceCode.trim(),
    taxCode: values.taxCode.trim(),
    licenseNumber: values.licenseNumber.trim(),
    description: values.description.trim(),
  };
}

/**
 * So khớp hồ sơ đọc lại với nội dung vừa gửi.
 *
 * PATCH hồ sơ chỉ trả `{ ok, isVerified, verificationRequired }` chứ không trả hồ sơ, nên sau khi ghi phải
 * đọc lại và đối chiếu từng trường mới dám báo "đã lưu" ‑ đúng cách app làm.
 */
export function profileMatches(saved: Record<string, unknown> | null, values: ProfileFormValues): boolean {
  if (!saved) return false;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return (
    text(saved.provider_name) === values.providerName.trim() &&
    text(saved.contact_name) === values.contactName.trim() &&
    text(saved.contact_phone) === values.contactPhone.trim() &&
    text(saved.province_code) === values.provinceCode.trim() &&
    text(saved.tax_code) === values.taxCode.trim() &&
    text(saved.license_number) === values.licenseNumber.trim() &&
    text(saved.description) === values.description.trim()
  );
}

// ───────── Đăng ký ─────────

export type RegisterFormValues = {
  providerName: string;
  contactName: string;
  contactPhone: string;
  email: string;
  password: string;
  provinceCode: string;
  taxCode: string;
  licenseNumber: string;
};

export function validateRegisterForm(values: RegisterFormValues): string | null {
  if (values.providerName.trim().length < 2) return "Nhập tên trung tâm / đơn vị đào tạo.";
  if (values.contactName.trim().length < 2) return "Nhập tên người phụ trách.";
  if (values.contactPhone.replace(/\D/g, "").length < 9) return "Số điện thoại liên hệ không hợp lệ.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return "Email đăng nhập chưa đúng định dạng.";
  if (values.password.length < 8) return "Mật khẩu tối thiểu 8 ký tự.";
  return null;
}

export function registerBody(values: RegisterFormValues): Record<string, unknown> {
  return {
    providerName: values.providerName.trim(),
    contactName: values.contactName.trim(),
    contactPhone: values.contactPhone.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
    provinceCode: values.provinceCode.trim(),
    taxCode: values.taxCode.trim(),
    licenseNumber: values.licenseNumber.trim(),
  };
}

// ───────── Gói và hạn mức ─────────

export const PAID_TIERS = ["basic", "premium"] as const;
export const PAYMENT_METHODS = ["bank_transfer", "momo"] as const;

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Chuyển khoản ngân hàng",
  momo: "Ví MoMo",
};

/** Hạn mức mở liên hệ Kho học viên theo gói; bản sao của `limits` trong route `candidates`. */
export const CANDIDATE_VIEW_LIMITS: Record<string, number> = { free: 0, basic: 60, premium: 300 };

/** Trạng thái đơn hàng; cùng tập giá trị với đơn của nhà tuyển dụng (`lib/admin.ts`, `lib/employer.ts`). */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Chờ Admin xác nhận",
  paid: "Đã xác nhận",
  rejected: "Bị từ chối",
  refunded: "Đã hoàn tiền",
  cancelled: "Đã hủy",
};

export const ORDER_STATUS_TONE: Record<string, StatusTone> = {
  pending: "amber",
  paid: "green",
  rejected: "red",
  refunded: "blue",
  cancelled: "gray",
};

export type QuotaUsage = { tier: string; verified: boolean; viewLimit: number; viewedCount: number };

/** Còn bao nhiêu lượt mở liên hệ trong tháng. Chưa xác minh thì máy chủ trả viewLimit = 0. */
export function remainingViews(usage: QuotaUsage | null): number {
  if (!usage) return 0;
  return Math.max(0, usage.viewLimit - usage.viewedCount);
}

export function quotaNote(usage: QuotaUsage | null): string {
  if (!usage) return "Đang kiểm tra hạn mức…";
  if (!usage.verified) return "Đơn vị chưa được Admin xác minh nên chưa mở được liên hệ.";
  if (usage.viewLimit === 0) return "Gói hiện tại không có lượt mở liên hệ. Nâng gói ở mục Gói & đơn hàng.";
  return `Đã dùng ${usage.viewedCount}/${usage.viewLimit} lượt mở liên hệ trong tháng. Mở lại hồ sơ đã xem trong tháng không trừ thêm lượt.`;
}
