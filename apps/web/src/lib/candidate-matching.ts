// Hằng số và hàm thuần cho "Gợi ý cho bạn" (AI Matching) trên web.
//
// BẢN SAO QUY TẮC CỦA APP (`utils/matchReasons.js`, `services/matchingApi.js`): mã lý do do backend quyết định, web chỉ
// dịch ra chữ; phản hồi lạ bị loại thay vì hiển thị. Tệp thuần dữ liệu, không import gì.

export const JOB_REASON_LABELS: Record<string, string> = {
  same_industry: "Cùng ngành nghề",
  similar_industry: "Ngành nghề gần giống",
  same_kcn: "Đúng KCN bạn chọn",
  work_province: "Đúng tỉnh bạn muốn làm",
  home_province: "Cùng tỉnh trong hồ sơ",
  salary_fit: "Phù hợp mức lương mong muốn",
  experience_fit: "Phù hợp kinh nghiệm",
  same_shift: "Đúng ca làm mong muốn",
  has_housing: "Có hỗ trợ nhà ở",
  similar_content: "Nội dung tương tự mong muốn của bạn",
};

export const SERVICE_REASON_LABELS: Record<string, string> = {
  near_work_place: "Gần nơi làm việc bạn chọn",
  same_province: "Cùng tỉnh với nơi làm việc",
  industry_training: "Liên quan ngành nghề của bạn",
  chosen_interest: "Bạn đã chọn quan tâm",
  needs_housing: "Bạn cần hỗ trợ nhà ở",
};

export const MISSING_FIELD_LABELS: Record<string, string> = {
  industry: "ngành nghề mong muốn",
  location: "tỉnh hoặc KCN muốn làm",
  salary: "mức lương tối thiểu",
  experience: "số năm kinh nghiệm",
  shift: "ca làm mong muốn",
  housing: "nhu cầu nhà ở",
};

export const MATCH_SERVICES = ["housing", "training", "insurance", "health", "finance"] as const;
export type MatchService = (typeof MATCH_SERVICES)[number];

export const SERVICE_OPTIONS: { value: MatchService; label: string; note: string }[] = [
  { value: "housing", label: "Thuê trọ", note: "Gợi ý phòng trọ gần nơi làm việc" },
  { value: "training", label: "Học nghề", note: "Cần bật mục này và khai Ngành nghề mong muốn trong Hồ sơ" },
  { value: "insurance", label: "Bảo hiểm", note: "Hiện sản phẩm bảo hiểm đã được duyệt" },
  { value: "health", label: "Y tế", note: "Hiện lối vào mục Y tế" },
  { value: "finance", label: "Tài chính", note: "Hiện lối vào mục Tài chính, chỉ khi bạn chọn" },
];

export const SERVICE_ICON: Record<string, string> = { rental: "🏠", course: "📚", insurance: "🛡️", health: "🏥", finance: "💰" };

/** Không hiển thị phần trăm như "độ chính xác"; chỉ chia mức để người dùng tự cân nhắc. */
export function matchBand(score: number | null): { label: string; tone: "high" | "medium" | "low" } | null {
  if (score === null || score === undefined) return null;
  if (score >= 75) return { label: "Rất phù hợp", tone: "high" };
  if (score >= 55) return { label: "Khá phù hợp", tone: "medium" };
  return { label: "Có thể phù hợp", tone: "low" };
}

export const reasonLabels = (codes: string[] | undefined, dictionary: Record<string, string>) =>
  (codes ?? []).map((code) => dictionary[code]).filter((label): label is string => Boolean(label));

const UUID = /^[0-9a-f-]{36}$/i;
export const isId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/**
 * Màn dịch vụ của app (`screen`) tương ứng với trang web. Màn lạ do phản hồi sai bị loại để không điều hướng tới
 * đâu đó ngoài kiểm soát.
 */
export function serviceHref(screen: string, params?: { courseId?: string }): string | null {
  switch (screen) {
    case "ThueTro":
      return "/dich-vu-cong-nhan/thue-tro";
    case "BaoHiem":
      return "/dich-vu-cong-nhan/bao-hiem";
    case "YTe":
      return "/dich-vu-cong-nhan/y-te";
    case "TaiChinh":
      return "/dich-vu-cong-nhan/tai-chinh";
    case "VocationalCourseDetail":
      return isId(params?.courseId) ? `/dich-vu-cong-nhan/hoc-nghe/${params.courseId}` : null;
    default:
      return null;
  }
}
