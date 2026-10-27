// Bộ chấm điểm có cấu trúc cho AI Matching. Hàm thuần, không phụ thuộc thư viện hay cơ sở dữ liệu, để kiểm thử độc lập.
// Trọng số là điểm khởi đầu để thử nghiệm, chưa được kiểm chứng; chỉnh ở WEIGHTS và đánh giá lại bằng dữ liệu thật.

export type Shift = "day" | "night" | "rotating" | "flexible";

export type MatchReason =
  | "same_industry"
  | "similar_industry"
  | "same_kcn"
  | "work_province"
  | "home_province"
  | "salary_fit"
  | "experience_fit"
  | "same_shift"
  | "has_housing"
  | "similar_content";

export interface MatchProfile {
  /** industry key đã chuẩn hóa (không dấu, chữ thường). */
  industryKey: string | null;
  /** Tỉnh công nhân CHỦ ĐỘNG chọn là nơi muốn làm (mã tỉnh). */
  workProvinceCode: string | null;
  /** Tỉnh trong hồ sơ (có thể chỉ là nơi ở): tín hiệu mềm hơn. */
  homeProvinceCode: string | null;
  kcnId: string | null;
  salaryMin: number | null;
  experienceYears: number | null;
  shift: Shift | null;
  needsHousing: boolean | null;
}

export interface MatchJob {
  id: string;
  industryKey: string | null;
  provinceCode: string;
  kcnId: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  shiftType: string | null;
  hasHousing: boolean;
  noExperienceRequired: boolean;
  isUrgent: boolean;
  createdAt: string;
}

export interface ScoreResult {
  /** 0–100, tính trên các tiêu chí đã có dữ liệu. */
  score: number;
  /** 0–1: phần trọng số có dữ liệu để so sánh (độ đầy đủ của hồ sơ theo tin này). */
  coverage: number;
  reasons: MatchReason[];
}

export const WEIGHTS = { industry: 30, location: 20, salary: 20, experience: 10, shift: 10, housing: 10 } as const;

interface Part { points: number; max: number; reason?: MatchReason }
const NOT_APPLICABLE: Part = { points: 0, max: 0 };

function industryPart(profile: MatchProfile, job: MatchJob): Part {
  const wanted = profile.industryKey?.trim();
  const actual = job.industryKey?.trim();
  if (!wanted || !actual) return NOT_APPLICABLE;
  const max = WEIGHTS.industry;
  if (wanted === actual) return { points: max, max, reason: "same_industry" };
  const shortEnough = Math.min(wanted.length, actual.length) >= 3;
  if (shortEnough && (wanted.includes(actual) || actual.includes(wanted))) return { points: Math.round(max * 0.8), max, reason: "similar_industry" };
  return { points: 0, max };
}

function locationPart(profile: MatchProfile, job: MatchJob): Part {
  const max = WEIGHTS.location;
  const hasSignal = Boolean(profile.kcnId || profile.workProvinceCode || profile.homeProvinceCode);
  if (!hasSignal) return NOT_APPLICABLE;
  if (profile.kcnId && job.kcnId === profile.kcnId) return { points: max, max, reason: "same_kcn" };
  if (profile.workProvinceCode && job.provinceCode === profile.workProvinceCode) return { points: Math.round(max * 0.85), max, reason: "work_province" };
  if (profile.homeProvinceCode && job.provinceCode === profile.homeProvinceCode) return { points: Math.round(max * 0.6), max, reason: "home_province" };
  return { points: 0, max };
}

function salaryPart(profile: MatchProfile, job: MatchJob): Part {
  const wanted = profile.salaryMin;
  const offered = job.salaryMax ?? job.salaryMin;
  if (!wanted || wanted <= 0 || offered == null || offered <= 0) return NOT_APPLICABLE;
  const max = WEIGHTS.salary;
  if (offered >= wanted) return { points: max, max, reason: "salary_fit" };
  const ratio = offered / wanted;
  if (ratio < 0.7) return { points: 0, max };
  return { points: Math.round(max * ((ratio - 0.7) / 0.3)), max };
}

function experiencePart(profile: MatchProfile, job: MatchJob): Part {
  const years = profile.experienceYears;
  if (years == null) return NOT_APPLICABLE;
  const max = WEIGHTS.experience;
  if (job.noExperienceRequired) return { points: max, max, reason: "experience_fit" };
  return years >= 1 ? { points: max, max, reason: "experience_fit" } : { points: Math.round(max * 0.3), max };
}

function shiftPart(profile: MatchProfile, job: MatchJob): Part {
  if (!profile.shift || !job.shiftType) return NOT_APPLICABLE;
  const max = WEIGHTS.shift;
  if (profile.shift === "flexible" || profile.shift === job.shiftType) return { points: max, max, reason: "same_shift" };
  return { points: 0, max };
}

function housingPart(profile: MatchProfile, job: MatchJob): Part {
  // Chỉ tính khi công nhân nói rõ cần nhà ở; "chưa trả lời" hoặc "không cần" không bị trừ điểm.
  if (profile.needsHousing !== true) return NOT_APPLICABLE;
  const max = WEIGHTS.housing;
  return job.hasHousing ? { points: max, max, reason: "has_housing" } : { points: 0, max };
}

export function scoreJob(profile: MatchProfile, job: MatchJob): ScoreResult {
  const parts = [industryPart(profile, job), locationPart(profile, job), salaryPart(profile, job), experiencePart(profile, job), shiftPart(profile, job), housingPart(profile, job)];
  const max = parts.reduce((sum, part) => sum + part.max, 0);
  const points = parts.reduce((sum, part) => sum + part.points, 0);
  const totalWeight = Object.values(WEIGHTS).reduce((sum, value) => sum + value, 0);
  const reasons = parts.filter(part => part.reason && part.points >= part.max * 0.6).map(part => part.reason as MatchReason);
  return { score: max === 0 ? 0 : Math.round((points / max) * 100), coverage: max / totalWeight, reasons };
}

/** Độ đầy đủ của hồ sơ để gợi ý: số tiêu chí có dữ liệu / tổng tiêu chí. */
export function profileCompleteness(profile: MatchProfile): { filled: number; total: number; missing: string[] } {
  const checks: Array<[string, boolean]> = [
    ["industry", Boolean(profile.industryKey)],
    ["location", Boolean(profile.kcnId || profile.workProvinceCode || profile.homeProvinceCode)],
    ["salary", Boolean(profile.salaryMin && profile.salaryMin > 0)],
    ["experience", profile.experienceYears != null],
    ["shift", Boolean(profile.shift)],
    ["housing", profile.needsHousing != null],
  ];
  return { filled: checks.filter(([, ok]) => ok).length, total: checks.length, missing: checks.filter(([, ok]) => !ok).map(([name]) => name) };
}

/** Kết hợp điểm cấu trúc với độ tương đồng ngữ nghĩa (0–1) khi có; không có thì giữ nguyên điểm cấu trúc. */
export function blendScore(structured: number, semantic: number | null, semanticWeight = 0.2): number {
  if (semantic == null || !Number.isFinite(semantic)) return structured;
  const clamped = Math.min(1, Math.max(0, semantic));
  return Math.round(structured * (1 - semanticWeight) + clamped * 100 * semanticWeight);
}

export interface RankedJob<T extends MatchJob = MatchJob> { job: T; result: ScoreResult; finalScore: number; reasons: MatchReason[] }

/** Xếp hạng: điểm giảm dần, rồi tin tuyển gấp, rồi tin mới. Ổn định và xác định để dễ kiểm thử. */
export function rankJobs<T extends MatchJob>(profile: MatchProfile, jobs: T[], semantic: Map<string, number> = new Map(), minScore = 0): Array<RankedJob<T>> {
  return jobs
    .map(job => {
      const result = scoreJob(profile, job);
      const sim = semantic.get(job.id) ?? null;
      const reasons: MatchReason[] = sim != null && sim >= 0.75 && !result.reasons.includes("similar_content") ? [...result.reasons, "similar_content"] : result.reasons;
      return { job, result, finalScore: blendScore(result.score, sim), reasons };
    })
    .filter(item => item.finalScore >= minScore)
    .sort((a, b) => b.finalScore - a.finalScore || Number(b.job.isUrgent) - Number(a.job.isUrgent) || b.job.createdAt.localeCompare(a.job.createdAt) || a.job.id.localeCompare(b.job.id));
}

// ---- Dịch vụ liên quan ----

export type ServiceReason = "near_work_place" | "same_province" | "industry_training" | "chosen_interest" | "needs_housing";

export interface RentalLite { provinceCode: string; nearbyZone: string | null; monthlyRentVnd: number }
export interface CourseLite { provinceCode: string | null; occupationKey: string | null; learningMode: string | null }

const sameText = (a: string, b: string) => a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a));

export function scoreRental(profile: MatchProfile, listing: RentalLite, kcnNameKey: string | null): { score: number; reasons: ServiceReason[] } {
  let score = 0; const reasons: ServiceReason[] = [];
  const place = profile.workProvinceCode || profile.homeProvinceCode;
  if (place && listing.provinceCode === place) { score += 50; reasons.push("same_province"); }
  const zone = listing.nearbyZone ? listing.nearbyZone.trim() : "";
  if (kcnNameKey && zone && sameText(zone.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase(), kcnNameKey)) { score += 40; reasons.push("near_work_place"); }
  if (profile.needsHousing === true) { score += 10; reasons.push("needs_housing"); }
  return { score, reasons };
}

export function scoreCourse(profile: MatchProfile, course: CourseLite): { score: number; reasons: ServiceReason[] } {
  let score = 0; const reasons: ServiceReason[] = [];
  if (profile.industryKey && course.occupationKey && sameText(profile.industryKey, course.occupationKey)) { score += 70; reasons.push("industry_training"); }
  const place = profile.workProvinceCode || profile.homeProvinceCode;
  if (place && course.provinceCode === place) { score += 30; reasons.push("same_province"); }
  else if (course.learningMode === "online") score += 10;
  return { score, reasons };
}
