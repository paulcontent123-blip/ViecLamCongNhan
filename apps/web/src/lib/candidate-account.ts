// Hằng số và hàm thuần cho tài khoản công nhân trên web.
//
// BẢN SAO QUY TẮC CỦA APP (`WorkerAccountScreen.js`, `CandidatePasswordForm.js`) và khớp schema của
// `api/auth/candidate/*` và `api/mobile/candidate/profile`. Đổi một bên thì đổi cả hai.
// Tệp thuần dữ liệu, không import gì từ React/Next.

export type ProfileValues = {
  fullName: string;
  dateOfBirth: string;
  zalo: string;
  province: string;
  desiredIndustry: string;
  desiredSalaryMin: string;
  experienceYears: string;
  preferredShift: string;
  needsHousing: string;
};

export const EMPTY_PROFILE: ProfileValues = {
  fullName: "",
  dateOfBirth: "",
  zalo: "",
  province: "",
  desiredIndustry: "",
  desiredSalaryMin: "",
  experienceYears: "",
  preferredShift: "",
  needsHousing: "",
};

export const SHIFT_OPTIONS = [
  { value: "day", label: "Ca ngày" },
  { value: "night", label: "Ca đêm" },
  { value: "rotating", label: "Ca xoay" },
  { value: "flexible", label: "Linh hoạt" },
];

export const HOUSING_OPTIONS = [
  { value: "yes", label: "Có" },
  { value: "no", label: "Không" },
];

export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  new: "Mới nhận",
  viewed: "Đã xem",
  contacted: "Đã liên hệ",
  rejected: "Từ chối",
  hired: "Đã tuyển",
};

export const APPLICATION_STATUS_TONE: Record<string, "amber" | "green" | "red" | "gray" | "blue"> = {
  new: "amber",
  viewed: "blue",
  contacted: "blue",
  rejected: "red",
  hired: "green",
};

const text = (value: unknown) => (typeof value === "string" ? value : "");
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? String(value) : "");

/** Đổi hồ sơ đọc từ máy chủ về dạng form (mọi ô là chuỗi). */
export function profileToValues(profile: Record<string, unknown>): ProfileValues {
  return {
    fullName: text(profile.fullName),
    dateOfBirth: text(profile.dateOfBirth),
    zalo: text(profile.zalo),
    province: text(profile.province),
    desiredIndustry: text(profile.desiredIndustry),
    desiredSalaryMin: num(profile.desiredSalaryMin),
    experienceYears: num(profile.experienceYears),
    preferredShift: text(profile.preferredShift),
    needsHousing: profile.needsHousing === true ? "yes" : profile.needsHousing === false ? "no" : "",
  };
}

/** Kiểm tra giống app; trả về lỗi theo từng ô. Máy chủ vẫn là nơi quyết định. */
export function profileErrors(values: ProfileValues): Partial<Record<keyof ProfileValues, string>> {
  const errors: Partial<Record<keyof ProfileValues, string>> = {};
  const name = values.fullName.trim();
  if (name.length < 2 || name.length > 100) errors.fullName = "Họ tên cần có từ 2 đến 100 ký tự.";
  if (values.zalo.trim().length > 24) errors.zalo = "Zalo không được vượt quá 24 ký tự.";
  if (values.province.trim().length > 100) errors.province = "Tỉnh/thành không được vượt quá 100 ký tự.";
  const salary = values.desiredSalaryMin.trim();
  if (salary) {
    const n = Number(salary);
    if (!Number.isSafeInteger(n) || n < 0 || n > 1_000_000_000) errors.desiredSalaryMin = "Lương tối thiểu phải là số nguyên từ 0 đến 1 tỷ đồng.";
  }
  const years = values.experienceYears.trim();
  if (years) {
    const n = Number(years);
    if (!Number.isSafeInteger(n) || n < 0 || n > 70) errors.experienceYears = "Kinh nghiệm phải là số nguyên từ 0 đến 70 năm.";
  }
  if (values.dateOfBirth) {
    const date = new Date(`${values.dateOfBirth}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(values.dateOfBirth) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== values.dateOfBirth ||
      date.getTime() > Date.now()
    ) {
      errors.dateOfBirth = "Ngày sinh không hợp lệ hoặc không được là ngày trong tương lai.";
    }
  }
  return errors;
}

/** Body PATCH hồ sơ: gửi đủ mọi trường như app, ô trống thành null/chuỗi rỗng. */
export function profileBody(values: ProfileValues): Record<string, unknown> {
  return {
    fullName: values.fullName.trim(),
    dateOfBirth: values.dateOfBirth || null,
    zalo: values.zalo.trim(),
    province: values.province.trim(),
    desiredIndustry: values.desiredIndustry.trim(),
    desiredSalaryMin: values.desiredSalaryMin.trim() ? Number(values.desiredSalaryMin) : null,
    experienceYears: values.experienceYears.trim() ? Number(values.experienceYears) : null,
    preferredShift: values.preferredShift || null,
    needsHousing: values.needsHousing === "yes" ? true : values.needsHousing === "no" ? false : null,
  };
}

/** Hồ sơ đọc lại có khớp với những gì vừa gửi không (dùng để xác nhận khi kết quả ghi chưa rõ). */
export function profileMatches(latest: Record<string, unknown>, sent: ProfileValues): boolean {
  const now = profileToValues(latest);
  const want = profileToValues({ ...profileBody(sent) });
  return (Object.keys(want) as (keyof ProfileValues)[]).every((key) => now[key] === want[key]);
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export const isValidPhone = (value: string) => /^0\d{9}$/.test(normalizePhone(value));

export function loginError(phone: string, password: string): string | null {
  if (!isValidPhone(phone)) return "Nhập số điện thoại gồm 10 chữ số.";
  if (!password) return "Nhập mật khẩu.";
  return null;
}

export function registerError(values: { fullName: string; phone: string; province: string; password: string }): string | null {
  if (values.fullName.trim().length < 2) return "Nhập họ tên từ 2 ký tự.";
  if (!isValidPhone(values.phone)) return "Nhập số điện thoại gồm 10 chữ số.";
  if (!values.province.trim()) return "Chọn tỉnh/thành.";
  if (values.password.length < 8) return "Mật khẩu cần ít nhất 8 ký tự.";
  return null;
}
