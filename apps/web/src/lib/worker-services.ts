// Hằng số, nhãn và định dạng cho khu "Dịch vụ công nhân" (Học nghề, Thuê trọ, Bảo hiểm, Tài chính, Y tế).
// Các trang này chỉ đọc qua `api/mobile/*` có sẵn, không thêm truy vấn hay quy tắc nghiệp vụ mới.
//
// ĐÂY LÀ BẢN SAO QUY TẮC CỦA APP: nhãn loại sản phẩm, cấp độ khóa học, hình thức học và danh sách chủ đề
// tư vấn tài chính phải khớp với app (`src/screens/worker/*`) và với máy chủ (`api/mobile/finance/inquiries`).
// Đổi một dòng ở đây thì phải đổi bản sao bên app, theo quy trình ở WEB_APP_SYNC.md mục 6 của repo app.
//
// Tệp thuần dữ liệu, KHÔNG import mô-đun nào khác, nên dùng được ở cả máy chủ lẫn trình duyệt và test chạy
// thẳng bằng node (alias `@/...` thì node không tự giải được). Chỗ nào cần tra cứu, hàm nhận vào qua tham số.

export const WORKER_SERVICE_KEYS = ["hoc-nghe", "thue-tro", "bao-hiem", "tai-chinh", "y-te"] as const;
export type WorkerServiceKey = (typeof WORKER_SERVICE_KEYS)[number];

/** Lớp Tailwind phải là chuỗi nguyên văn (Tailwind quét mã nguồn), nên mỗi khu ghi sẵn đủ lớp cần dùng. */
export type WorkerServiceAccent = {
  /** Nền dải màu của hero đầu trang. */
  hero: string;
  /** Nền nhạt + chữ đậm cho nhãn, chip đang chọn, hộp thông tin. */
  tint: string;
  /** Nút chính (nền đặc, chữ trắng). */
  button: string;
  /** Chữ màu khu, dùng cho giá và liên kết. */
  text: string;
  /** Viền màu khu cho nút phụ và thẻ đang chọn. */
  border: string;
  /** Viền khi ô nhập được focus. */
  focus: string;
};

export type WorkerServiceMeta = {
  key: WorkerServiceKey;
  /** Tên hiển thị trên menu, hero và thẻ ở trang tổng. */
  title: string;
  icon: string;
  href: string;
  /** Một dòng mô tả cho menu và thẻ ở trang tổng. */
  tagline: string;
  /** Câu mô tả dài hơn dưới tiêu đề hero; cũng dùng làm mô tả SEO. */
  description: string;
  accent: WorkerServiceAccent;
};

const SECTION = "/dich-vu-cong-nhan";

export const WORKER_SERVICES: Record<WorkerServiceKey, WorkerServiceMeta> = {
  "hoc-nghe": {
    key: "hoc-nghe",
    title: "Học nghề",
    icon: "🎓",
    href: `${SECTION}/hoc-nghe`,
    tagline: "Khóa học nghề từ đơn vị đào tạo đã xác minh",
    description:
      "Tìm khóa học nghề của các đơn vị đào tạo đã được xác minh, xem học phí và chứng chỉ, rồi gửi hồ sơ học viên hoặc hỏi tư vấn.",
    accent: {
      hero: "bg-gradient-to-br from-[#6B21A8] to-[#4A1272]",
      tint: "bg-[#F3E8FF] text-[#6B21A8]",
      button: "bg-[#6B21A8] text-white hover:brightness-110",
      text: "text-[#6B21A8]",
      border: "border-[#6B21A8]",
      focus: "focus:border-[#6B21A8]",
    },
  },
  "thue-tro": {
    key: "thue-tro",
    title: "Thuê trọ",
    icon: "🏠",
    href: `${SECTION}/thue-tro`,
    tagline: "Phòng trọ gần khu công nghiệp, tin đã được duyệt",
    description:
      "Tin cho thuê của chủ trọ đã xác minh và được Admin duyệt. Thông tin liên hệ của bạn chỉ được chia sẻ khi bạn chủ động gửi yêu cầu.",
    accent: {
      hero: "bg-gradient-to-br from-[#1B5299] to-[#0E3566]",
      tint: "bg-[#EBF2FF] text-[#1B5299]",
      button: "bg-[#1B5299] text-white hover:brightness-110",
      text: "text-[#1B5299]",
      border: "border-[#1B5299]",
      focus: "focus:border-[#1B5299]",
    },
  },
  "bao-hiem": {
    key: "bao-hiem",
    title: "Bảo hiểm",
    icon: "🛡️",
    href: `${SECTION}/bao-hiem`,
    tagline: "BHXH tự nguyện, BHYT, tai nạn và sức khỏe",
    description:
      "Sản phẩm bảo hiểm đã được Admin duyệt từ các đơn vị đã xác minh. Trang này chỉ giới thiệu và nhận yêu cầu tư vấn, không bán hay phát hành hợp đồng.",
    accent: {
      hero: "bg-gradient-to-br from-[#1A7A4A] to-[#0D5235]",
      tint: "bg-[#E8F5EE] text-[#1A7A4A]",
      button: "bg-[#1A7A4A] text-white hover:brightness-110",
      text: "text-[#1A7A4A]",
      border: "border-[#1A7A4A]",
      focus: "focus:border-[#1A7A4A]",
    },
  },
  "tai-chinh": {
    key: "tai-chinh",
    title: "Tài chính",
    icon: "💳",
    href: `${SECTION}/tai-chinh`,
    tagline: "Ứng lương trước, vay tiêu dùng, chuyển tiền về quê",
    description:
      "Thông tin đã được duyệt về ứng lương trước, vay tiêu dùng và chuyển tiền về quê. Gửi yêu cầu ở đây là để được tư vấn, chưa phải hồ sơ vay hay lệnh giao dịch.",
    accent: {
      hero: "bg-gradient-to-br from-[#117A65] to-[#075B50]",
      tint: "bg-[#E6F4F1] text-[#117A65]",
      button: "bg-[#117A65] text-white hover:brightness-110",
      text: "text-[#117A65]",
      border: "border-[#117A65]",
      focus: "focus:border-[#117A65]",
    },
  },
  "y-te": {
    key: "y-te",
    title: "Y tế & Sức khỏe",
    icon: "🏥",
    href: `${SECTION}/y-te`,
    tagline: "Tư vấn, khám bệnh và sàng lọc sức khỏe",
    description:
      "Dịch vụ của cơ sở y tế đã xác minh. Bạn chỉ để lại thông tin liên hệ và khung giờ mong muốn; không gửi triệu chứng hay hồ sơ bệnh án tại đây.",
    accent: {
      hero: "bg-gradient-to-br from-[#157A68] to-[#0B5146]",
      tint: "bg-[#E8F6F3] text-[#157A68]",
      button: "bg-[#157A68] text-white hover:brightness-110",
      text: "text-[#157A68]",
      border: "border-[#157A68]",
      focus: "focus:border-[#157A68]",
    },
  },
};

export const WORKER_SERVICE_LIST: WorkerServiceMeta[] = WORKER_SERVICE_KEYS.map((key) => WORKER_SERVICES[key]);

// ───────── Học nghề ─────────

/** Cấp độ để lọc; gửi nguyên văn lên `?level=` nên phải khớp dữ liệu đơn vị đào tạo nhập (giống app). */
export const VOCATIONAL_LEVELS = ["Cơ bản", "Trung cấp", "Nâng cao"] as const;

export const LEARNING_MODE_LABEL: Record<string, string> = {
  onsite: "Trực tiếp",
  online: "Trực tuyến",
  hybrid: "Kết hợp",
};

// ───────── Bảo hiểm ─────────

export const INSURANCE_CATEGORIES = ["bhxh_voluntary", "bhyt", "accident", "health", "other"] as const;

export const INSURANCE_CATEGORY_LABEL: Record<string, string> = {
  bhxh_voluntary: "BHXH tự nguyện",
  bhyt: "BHYT",
  accident: "Tai nạn",
  health: "Sức khỏe",
  other: "Khác",
};

// ───────── Tài chính ─────────

export const FINANCE_PUBLIC_CATEGORIES = ["ewa", "consumer_loan", "remittance"] as const;
export type FinanceCategory = (typeof FINANCE_PUBLIC_CATEGORIES)[number];

/** Nhãn trên trang công khai; khác nhãn rút gọn ở `lead-export.ts` (dùng cho tệp CSV của Admin). */
export const FINANCE_PUBLIC_CATEGORY_LABEL: Record<string, string> = {
  ewa: "Ứng lương trước",
  consumer_loan: "Vay tiêu dùng",
  remittance: "Chuyển tiền về quê",
};

/** Chủ đề tư vấn theo nhóm sản phẩm. Máy chủ từ chối 400 nếu chủ đề không thuộc nhóm (`api/mobile/finance/inquiries`). */
export const FINANCE_TOPICS: Record<FinanceCategory, { value: string; label: string }[]> = {
  ewa: [
    { value: "eligibility", label: "Điều kiện tham gia" },
    { value: "fees", label: "Cách tính phí và thời hạn" },
    { value: "registration", label: "Cách đăng ký qua đơn vị" },
  ],
  consumer_loan: [
    { value: "eligibility", label: "Điều kiện sản phẩm" },
    { value: "costs", label: "Lãi/phí và tổng chi phí" },
    { value: "repayment", label: "Lịch và cách trả nợ" },
  ],
  remittance: [
    { value: "coverage", label: "Khu vực hỗ trợ" },
    { value: "fees_exchange", label: "Phí và tỷ giá" },
    { value: "receiving", label: "Cách nhận và thời gian xử lý" },
  ],
};

export const FINANCE_TOPIC_FIELD_LABEL: Record<FinanceCategory, string> = {
  ewa: "Nội dung ứng lương cần tư vấn *",
  consumer_loan: "Nội dung vay tiêu dùng cần tư vấn *",
  remittance: "Nội dung chuyển tiền cần tư vấn *",
};

/** Nhóm sản phẩm lạ (web cũ hơn máy chủ) thì dùng chủ đề của ứng lương, đúng cách app xử lý. */
export function financeTopicsFor(category: string | null | undefined) {
  return FINANCE_TOPICS[(category ?? "") as FinanceCategory] ?? FINANCE_TOPICS.ewa;
}

// ───────── Y tế ─────────

export const HEALTH_CATEGORIES = ["consultation", "examination", "screening"] as const;

export const HEALTH_CATEGORY_LABEL: Record<string, string> = {
  consultation: "Tư vấn",
  examination: "Khám bệnh",
  screening: "Sàng lọc sức khỏe",
};

// ───────── Câu đồng ý ─────────

/** Phiên bản câu đồng ý chia sẻ mà giao diện này đang hiển thị. Phải bằng `LEAD_SHARE_CONSENT_VERSION`
 *  ở `lead-export.ts` (máy chủ ghi phiên bản đó vào bản ghi) và bằng chữ app đang hiện ‑ test kiểm tra điều này. */
export const SHARE_CONSENT_VERSION = "2026-11-v2";

/** Đồng ý riêng, KHÔNG bắt buộc: cho Admin chia sẻ hồ sơ cho đối tác. Chữ phải khớp app (`utils/shareConsent.js`). */
export const SHARE_CONSENT_TEXT =
  "Tôi đồng ý chia sẻ thông tin hồ sơ (họ tên, số điện thoại, nhu cầu) cho bên thứ ba để được liên hệ tư vấn. Không bắt buộc.";

/** Đồng ý BẮT BUỘC để gửi được yêu cầu: máy chủ chỉ nhận khi `contactConsent` là true. */
export const CONTACT_CONSENT_TEXT: Record<Exclude<WorkerServiceKey, "hoc-nghe">, string> = {
  "thue-tro": "Tôi đồng ý chia sẻ họ tên, số điện thoại và lời nhắn với chủ trọ của tin này để được liên hệ.",
  "bao-hiem": "Tôi đồng ý để đơn vị cung cấp liên hệ tư vấn về sản phẩm này theo thông tin tôi để lại.",
  "tai-chinh": "Tôi đồng ý để Admin liên hệ tư vấn theo thông tin tôi để lại. Đây chưa phải hồ sơ vay hay lệnh giao dịch.",
  "y-te": "Tôi đồng ý để cơ sở y tế đã chọn liên hệ về yêu cầu dịch vụ và khung giờ mong muốn của tôi.",
};

// ───────── Định dạng ─────────

/** Học phí: 0 là miễn phí, thiếu hoặc không phải số nguyên thì để công nhân liên hệ (giống app). */
export function formatTuition(value: unknown): string {
  if (!Number.isSafeInteger(value)) return "Liên hệ đơn vị đào tạo";
  const amount = value as number;
  return amount === 0 ? "Miễn phí" : `${amount.toLocaleString("vi-VN")}đ`;
}

/** Giá thuê mỗi tháng. Thiếu số thì không bịa "0đ". */
export function formatRent(value: unknown): string {
  if (!Number.isSafeInteger(value)) return "Liên hệ chủ trọ";
  const amount = value as number;
  return amount === 0 ? "Thỏa thuận" : `${amount.toLocaleString("vi-VN")}đ/tháng`;
}

/** Diện tích; bỏ phần thập phân .0 cho gọn. */
export function formatArea(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return `${Number(value.toFixed(1)).toLocaleString("vi-VN")} m²`;
}

/** Ngày dạng `YYYY-MM-DD` trong cơ sở dữ liệu là ngày theo lịch, không có giờ: hiển thị nguyên ngày đó,
 *  không đưa qua `new Date()` để tránh lệch một ngày vì múi giờ. Giá trị khác thì trả nguyên văn. */
export function formatCalendarDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value.trim();
  const [, year, month, day] = match;
  return `${Number(day)}/${Number(month)}/${year}`;
}

/**
 * Tên tỉnh/thành để hiển thị cạnh địa chỉ.
 *
 * Máy chủ nhận `provinceCode` là chuỗi tự do tối đa 32 ký tự, không đối chiếu danh sách 34 tỉnh/thành, nên dữ
 * liệu cũ có cả mã đúng ("HCM"), chữ người nhập ("Tp.HCM") lẫn số vô nghĩa ("00700"). Mã đúng thì trả tên đầy
 * đủ; chuỗi có chữ thì giữ nguyên để không mất thông tin; còn lại trả null để giao diện bỏ hẳn phần này
 * thay vì hiện một dãy số khó hiểu bên cạnh địa chỉ.
 *
 * `resolve` là `provinceName` của `lib/provinces`, truyền vào để tệp này không phải import gì (xem đầu tệp).
 */
export function displayProvince(
  code: string | null | undefined,
  resolve: (code: string) => string,
): string | null {
  const raw = (code ?? "").trim();
  if (!raw) return null;
  const resolved = resolve(raw);
  if (resolved && resolved !== raw) return resolved;
  return /\p{L}/u.test(raw) ? raw : null;
}

/** Hôm nay theo giờ Việt Nam, dạng `YYYY-MM-DD`. Dùng làm mốc nhỏ nhất cho ô chọn ngày hẹn,
 *  tính theo múi giờ Việt Nam để máy đặt sai múi giờ không chặn mất ngày hôm nay. */
export function todayInVietnam(now: Date = new Date()): string {
  // en-CA cho ra đúng dạng YYYY-MM-DD.
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

/** Tách phần tóm tắt nhiều dòng (quyền lợi, điều kiện) thành danh sách gạch đầu dòng. */
export function splitLines(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}
