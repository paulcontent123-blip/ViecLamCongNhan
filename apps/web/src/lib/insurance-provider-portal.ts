// Cấu hình cổng tự phục vụ của Đơn vị bảo hiểm trên web: ô nhập, kiểm tra, dựng body gửi lên.
//
// BẢN SAO QUY TẮC CỦA APP (`utils/insuranceProviderForm.js`) và khớp schema của `api/insurance-providers`,
// `api/mobile/insurance-provider/profile` và `.../products`. Đổi một bên thì đổi cả hai.

import { PROVINCES } from "@/lib/provinces";
import { INSURANCE_CATEGORY_LABEL } from "@/lib/worker-services";
import {
  isHttpUrl,
  isValidDate,
  textOf,
  valuesMatch,
  type FieldDef,
  type Values,
} from "@/lib/provider-portal-common";

const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));

export const INSURANCE_PROVIDER_TYPES = [
  { value: "insurance_company", label: "Doanh nghiệp bảo hiểm" },
  { value: "licensed_agent", label: "Đại lý được ủy quyền" },
  { value: "public_program", label: "Chương trình công" },
];

export const INSURANCE_CATEGORY_OPTIONS = ["bhxh_voluntary", "bhyt", "accident", "health", "other"].map((value) => ({
  value,
  label: INSURANCE_CATEGORY_LABEL[value],
}));

// ───────── Đăng ký ─────────

export const INSURANCE_REGISTER_FIELDS: FieldDef[] = [
  { key: "providerName", label: "Tên đơn vị *", maxLength: 160 },
  { key: "providerType", label: "Loại đơn vị *", kind: "select", options: INSURANCE_PROVIDER_TYPES },
  { key: "contactName", label: "Người phụ trách *", maxLength: 120, half: true },
  { key: "contactPhone", label: "Số điện thoại liên hệ *", kind: "tel", inputMode: "tel", maxLength: 20, half: true },
  { key: "email", label: "Email đăng nhập *", kind: "email", inputMode: "email", maxLength: 254, half: true },
  { key: "password", label: "Mật khẩu (tối thiểu 8 ký tự) *", kind: "password", maxLength: 128, half: true },
  { key: "provinceCode", label: "Tỉnh/thành", kind: "select", options: PROVINCE_OPTIONS, placeholder: "Chưa chọn" },
  { key: "taxCode", label: "Mã số thuế", maxLength: 32, half: true },
  { key: "licenseNumber", label: "Số giấy phép / ủy quyền", maxLength: 80, half: true },
];

export const INSURANCE_REGISTER_INITIAL: Values = {
  providerName: "",
  providerType: "insurance_company",
  contactName: "",
  contactPhone: "",
  email: "",
  password: "",
  provinceCode: "",
  taxCode: "",
  licenseNumber: "",
};

export function insuranceRegisterError(values: Values): string | null {
  if (values.providerName.trim().length < 2) return "Nhập tên đơn vị (tối thiểu 2 ký tự).";
  if (values.contactName.trim().length < 2) return "Nhập tên người phụ trách.";
  if (values.contactPhone.replace(/\D/g, "").length < 9) return "Số điện thoại liên hệ không hợp lệ.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return "Email đăng nhập chưa đúng định dạng.";
  if (values.password.length < 8) return "Mật khẩu tối thiểu 8 ký tự.";
  return null;
}

export function insuranceRegisterBody(values: Values): Record<string, unknown> {
  return {
    providerName: values.providerName.trim(),
    providerType: values.providerType,
    contactName: values.contactName.trim(),
    contactPhone: values.contactPhone.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
    provinceCode: values.provinceCode.trim(),
    taxCode: values.taxCode.trim(),
    licenseNumber: values.licenseNumber.trim(),
  };
}

// ───────── Hồ sơ ─────────

export const INSURANCE_PROFILE_FIELDS: FieldDef[] = [
  { key: "providerName", label: "Tên đơn vị *", maxLength: 160 },
  { key: "providerType", label: "Loại đơn vị *", kind: "select", options: INSURANCE_PROVIDER_TYPES },
  { key: "contactName", label: "Người phụ trách *", maxLength: 120, half: true },
  { key: "contactPhone", label: "Số điện thoại *", kind: "tel", inputMode: "tel", maxLength: 20, half: true },
  { key: "provinceCode", label: "Tỉnh/thành", kind: "select", options: PROVINCE_OPTIONS, placeholder: "Chưa chọn" },
  { key: "taxCode", label: "Mã số thuế", maxLength: 32, half: true },
  { key: "licenseNumber", label: "Số giấy phép / ủy quyền", maxLength: 80, half: true },
  { key: "description", label: "Giới thiệu đơn vị", kind: "textarea", rows: 4, maxLength: 2000 },
];

export function insuranceProfileToValues(profile: Record<string, unknown>): Values {
  const type = textOf(profile.provider_type);
  return {
    providerName: textOf(profile.provider_name),
    providerType: INSURANCE_PROVIDER_TYPES.some((option) => option.value === type) ? type : "insurance_company",
    contactName: textOf(profile.contact_name),
    contactPhone: textOf(profile.contact_phone),
    provinceCode: textOf(profile.province_code),
    taxCode: textOf(profile.tax_code),
    licenseNumber: textOf(profile.license_number),
    description: textOf(profile.description),
  };
}

export function insuranceProfileError(values: Values): string | null {
  if (values.providerName.trim().length < 2) return "Nhập tên đơn vị (tối thiểu 2 ký tự).";
  if (values.contactName.trim().length < 2) return "Nhập tên người phụ trách.";
  if (values.contactPhone.replace(/\D/g, "").length < 9) return "Số điện thoại liên hệ không hợp lệ.";
  return null;
}

export function insuranceProfileBody(values: Values): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of Object.keys(insuranceProfileToValues({}))) body[key] = (values[key] ?? "").trim();
  return body;
}

export const insuranceProfileMatches = (latest: Record<string, unknown>, sent: Values) =>
  valuesMatch(insuranceProfileToValues(latest), sent);

// ───────── Sản phẩm ─────────

export const INSURANCE_PRODUCT_FIELDS: FieldDef[] = [
  { key: "category", label: "Loại sản phẩm *", kind: "select", options: INSURANCE_CATEGORY_OPTIONS },
  { key: "title", label: "Tên sản phẩm *", maxLength: 160 },
  { key: "subtitle", label: "Mô tả ngắn", maxLength: 160 },
  { key: "description", label: "Mô tả và phạm vi tư vấn * (tối thiểu 20 ký tự)", kind: "textarea", rows: 4, maxLength: 10000 },
  { key: "priceLabel", label: "Phí / mức đóng", maxLength: 240, placeholder: "Ví dụ: Từ 99.000đ/năm" },
  { key: "benefitsSummary", label: "Quyền lợi tóm tắt", kind: "textarea", rows: 3, maxLength: 3000, hint: "Mỗi ý một dòng; hai ý đầu hiện thành nhãn nhanh trên trang công khai." },
  { key: "eligibilityText", label: "Điều kiện tham gia", kind: "textarea", rows: 3, maxLength: 3000 },
  { key: "exclusionsText", label: "Loại trừ / giới hạn", kind: "textarea", rows: 3, maxLength: 3000 },
  { key: "termsUrl", label: "Liên kết điều khoản chính thức", maxLength: 1000, placeholder: "https://…", half: true },
  { key: "updatedTermsAt", label: "Ngày cập nhật điều khoản", kind: "date", half: true },
];

export const INSURANCE_PRODUCT_EMPTY: Values = {
  category: "accident",
  title: "",
  subtitle: "",
  description: "",
  priceLabel: "",
  benefitsSummary: "",
  eligibilityText: "",
  exclusionsText: "",
  termsUrl: "",
  updatedTermsAt: "",
};

export function insuranceProductToValues(product: Record<string, unknown>): Values {
  const category = textOf(product.category);
  return {
    category: INSURANCE_CATEGORY_OPTIONS.some((option) => option.value === category) ? category : "accident",
    title: textOf(product.title),
    subtitle: textOf(product.subtitle),
    description: textOf(product.description),
    priceLabel: textOf(product.price_label),
    benefitsSummary: textOf(product.benefits_summary),
    eligibilityText: textOf(product.eligibility_text),
    exclusionsText: textOf(product.exclusions_text),
    termsUrl: textOf(product.terms_url),
    updatedTermsAt: textOf(product.updated_terms_at),
  };
}

/** Thông báo lỗi đầu tiên (tiếng Việt) hoặc null nếu hợp lệ; không gọi mạng. */
export function insuranceProductError(values: Values): string | null {
  const title = values.title.trim();
  if (!INSURANCE_CATEGORY_OPTIONS.some((option) => option.value === values.category)) return "Chọn loại sản phẩm.";
  if (title.length < 3) return "Tên sản phẩm tối thiểu 3 ký tự.";
  if (values.subtitle.trim().length > 160) return "Mô tả ngắn tối đa 160 ký tự.";
  if (values.description.trim().length < 20) return "Mô tả và phạm vi tư vấn tối thiểu 20 ký tự.";
  if (values.priceLabel.trim().length > 240) return "Phí / mức đóng tối đa 240 ký tự.";
  const url = values.termsUrl.trim();
  if (url && !isHttpUrl(url)) return "Liên kết điều khoản cần bắt đầu bằng http:// hoặc https://.";
  if (values.updatedTermsAt.trim() && !isValidDate(values.updatedTermsAt.trim())) return "Ngày cập nhật điều khoản chưa hợp lệ.";
  return null;
}

/** `updatedTermsAt` bỏ hẳn khi trống, đúng cách app làm (máy chủ không nhận chuỗi rỗng cho trường ngày). */
export function insuranceProductBody(values: Values): Record<string, unknown> {
  const body: Record<string, unknown> = { category: values.category };
  for (const key of ["title", "subtitle", "description", "priceLabel", "benefitsSummary", "eligibilityText", "exclusionsText", "termsUrl"]) {
    body[key] = (values[key] ?? "").trim();
  }
  const updated = values.updatedTermsAt.trim();
  if (updated) body.updatedTermsAt = updated;
  return body;
}

export function insuranceProductMeta(product: Record<string, unknown>): string[] {
  const category = textOf(product.category);
  return [INSURANCE_CATEGORY_LABEL[category] ?? category, textOf(product.price_label)].filter(Boolean);
}
