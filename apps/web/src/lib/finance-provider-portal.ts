// Cấu hình cổng tự phục vụ của Đơn vị tài chính trên web: ô nhập, kiểm tra, dựng body gửi lên.
//
// BẢN SAO QUY TẮC CỦA APP (`utils/financeProviderForm.js`) và khớp schema của `api/finance-providers`,
// `api/mobile/finance-provider/profile` và `.../products`. Đổi một bên thì đổi cả hai.
//
// Khác Bảo hiểm ở ba điểm do máy chủ ép: GIẤY PHÉP bắt buộc ngay lúc đăng ký và khi sửa hồ sơ; hồ sơ giấy phép có thể
// là liên kết http(s) hoặc tệp tải lên kho riêng (`private-storage:…`); và mỗi sản phẩm phải kèm căn cứ phí/lãi.

import { PROVINCES } from "@/lib/provinces";
import {
  isHttpUrl,
  isValidDate,
  textOf,
  valuesMatch,
  type FieldDef,
  type Values,
} from "@/lib/provider-portal-common";

const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));

export const FINANCE_PROVIDER_TYPES = [
  { value: "bank", label: "Ngân hàng" },
  { value: "finance_company", label: "Công ty tài chính" },
  { value: "remittance_provider", label: "Đơn vị chuyển tiền" },
  { value: "other", label: "Đơn vị khác" },
];

/** Nhãn đúng như app (`financeProviderForm.js`): nhóm Ứng lương ghi kèm (EWA). */
export const FINANCE_CATEGORY_OPTIONS = [
  { value: "ewa", label: "Ứng lương trước (EWA)" },
  { value: "consumer_loan", label: "Vay tiêu dùng" },
  { value: "remittance", label: "Chuyển tiền về quê" },
];

/** Hồ sơ giấy phép lưu ở kho riêng được máy chủ ghi dưới dạng `private-storage:<đường dẫn>`. */
export const PRIVATE_STORAGE_PREFIX = "private-storage:";
export const isPrivateEvidence = (value: string) => value.trim().startsWith(PRIVATE_STORAGE_PREFIX);

// ───────── Đăng ký ─────────

export const FINANCE_REGISTER_FIELDS: FieldDef[] = [
  { key: "providerName", label: "Tên đơn vị *", maxLength: 160 },
  { key: "providerType", label: "Loại đơn vị *", kind: "select", options: FINANCE_PROVIDER_TYPES },
  { key: "contactName", label: "Người phụ trách *", maxLength: 120, half: true },
  { key: "contactPhone", label: "Số điện thoại liên hệ *", kind: "tel", inputMode: "tel", maxLength: 20, half: true },
  { key: "email", label: "Email đăng nhập *", kind: "email", inputMode: "email", maxLength: 254, half: true },
  { key: "password", label: "Mật khẩu (tối thiểu 8 ký tự) *", kind: "password", maxLength: 128, half: true },
  { key: "provinceCode", label: "Tỉnh/thành", kind: "select", options: PROVINCE_OPTIONS, placeholder: "Chưa chọn" },
  { key: "taxCode", label: "Mã số thuế", maxLength: 32, half: true },
  { key: "licenseNumber", label: "Số giấy phép / ủy quyền *", maxLength: 80, half: true },
  {
    key: "licenseEvidenceUrl",
    label: "Liên kết hồ sơ giấy phép (có thể tải tệp sau khi đăng ký)",
    maxLength: 1000,
    placeholder: "https://…",
  },
];

export const FINANCE_REGISTER_INITIAL: Values = {
  providerName: "",
  providerType: "finance_company",
  contactName: "",
  contactPhone: "",
  email: "",
  password: "",
  provinceCode: "",
  taxCode: "",
  licenseNumber: "",
  licenseEvidenceUrl: "",
};

export function financeRegisterError(values: Values): string | null {
  if (values.providerName.trim().length < 2) return "Nhập tên đơn vị (tối thiểu 2 ký tự).";
  if (values.contactName.trim().length < 2) return "Nhập tên người phụ trách.";
  if (values.contactPhone.replace(/\D/g, "").length < 9) return "Số điện thoại liên hệ không hợp lệ.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return "Email đăng nhập chưa đúng định dạng.";
  if (values.password.length < 8) return "Mật khẩu tối thiểu 8 ký tự.";
  if (!values.licenseNumber.trim()) return "Nhập số giấy phép / ủy quyền.";
  const evidence = values.licenseEvidenceUrl.trim();
  if (evidence && !isHttpUrl(evidence)) return "Liên kết hồ sơ giấy phép không hợp lệ.";
  return null;
}

export function financeRegisterBody(values: Values): Record<string, unknown> {
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
    licenseEvidenceUrl: values.licenseEvidenceUrl.trim(),
  };
}

// ───────── Hồ sơ ─────────

const FINANCE_PROFILE_BASE: FieldDef[] = [
  { key: "providerName", label: "Tên đơn vị *", maxLength: 160 },
  { key: "providerType", label: "Loại đơn vị *", kind: "select", options: FINANCE_PROVIDER_TYPES },
  { key: "contactName", label: "Người phụ trách *", maxLength: 120, half: true },
  { key: "contactPhone", label: "Số điện thoại *", kind: "tel", inputMode: "tel", maxLength: 20, half: true },
  { key: "provinceCode", label: "Tỉnh/thành", kind: "select", options: PROVINCE_OPTIONS, placeholder: "Chưa chọn" },
  { key: "taxCode", label: "Mã số thuế", maxLength: 32, half: true },
  { key: "licenseNumber", label: "Số giấy phép / ủy quyền *", maxLength: 80, half: true },
];

/**
 * Hồ sơ giấy phép đã tải tệp lên kho riêng thì KHÔNG hiện ô liên kết: giá trị `private-storage:…` là mã nội bộ,
 * người dùng không đọc hay sửa được. Khi đó giữ nguyên giá trị khi lưu (máy chủ chấp nhận), và chỉ cho thay bằng
 * cách tải tệp mới.
 */
export function financeProfileFields(values: Values): FieldDef[] {
  const evidence: FieldDef = {
    key: "licenseEvidenceUrl",
    label: "Liên kết hồ sơ giấy phép *",
    maxLength: 1200,
    placeholder: "https://… (hoặc tải tệp ở khung bên dưới)",
  };
  const tail: FieldDef = { key: "description", label: "Giới thiệu đơn vị", kind: "textarea", rows: 4, maxLength: 2000 };
  return isPrivateEvidence(values.licenseEvidenceUrl ?? "")
    ? [...FINANCE_PROFILE_BASE, tail]
    : [...FINANCE_PROFILE_BASE, evidence, tail];
}

export function financeProfileToValues(profile: Record<string, unknown>): Values {
  const type = textOf(profile.provider_type);
  return {
    providerName: textOf(profile.provider_name),
    providerType: FINANCE_PROVIDER_TYPES.some((option) => option.value === type) ? type : "finance_company",
    contactName: textOf(profile.contact_name),
    contactPhone: textOf(profile.contact_phone),
    provinceCode: textOf(profile.province_code),
    taxCode: textOf(profile.tax_code),
    licenseNumber: textOf(profile.license_number),
    licenseEvidenceUrl: textOf(profile.license_evidence_url),
    description: textOf(profile.description),
  };
}

export function financeProfileError(values: Values): string | null {
  if (values.providerName.trim().length < 2) return "Nhập tên đơn vị (tối thiểu 2 ký tự).";
  if (values.contactName.trim().length < 2) return "Nhập tên người phụ trách.";
  if (values.contactPhone.replace(/\D/g, "").length < 9) return "Số điện thoại liên hệ không hợp lệ.";
  if (!values.licenseNumber.trim()) return "Nhập số giấy phép / ủy quyền.";
  const evidence = values.licenseEvidenceUrl.trim();
  if (!evidence) return "Tải hồ sơ giấy phép hoặc nhập liên kết hồ sơ.";
  if (!isPrivateEvidence(evidence) && !isHttpUrl(evidence)) return "Liên kết hồ sơ giấy phép không hợp lệ.";
  return null;
}

export function financeProfileBody(values: Values): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of Object.keys(financeProfileToValues({}))) body[key] = (values[key] ?? "").trim();
  return body;
}

export const financeProfileMatches = (latest: Record<string, unknown>, sent: Values) =>
  valuesMatch(financeProfileToValues(latest), sent);

// ───────── Sản phẩm ─────────

export const FINANCE_PRODUCT_FIELDS: FieldDef[] = [
  { key: "category", label: "Loại sản phẩm *", kind: "select", options: FINANCE_CATEGORY_OPTIONS },
  { key: "title", label: "Tên sản phẩm *", maxLength: 160 },
  { key: "subtitle", label: "Mô tả ngắn", maxLength: 160 },
  { key: "description", label: "Mô tả và phạm vi tư vấn * (tối thiểu 20 ký tự)", kind: "textarea", rows: 4, maxLength: 10000 },
  {
    key: "priceLabel",
    label: "Phí / lãi *",
    maxLength: 240,
    placeholder: "Theo tài liệu chính thức, hoặc nêu rõ chưa có mức cụ thể",
  },
  { key: "pricingSourceUrl", label: "Liên kết căn cứ phí/lãi *", maxLength: 1000, placeholder: "https://…", half: true },
  { key: "pricingEffectiveAt", label: "Ngày hiệu lực phí/lãi *", kind: "date", half: true },
  { key: "benefitsSummary", label: "Quyền lợi tóm tắt", kind: "textarea", rows: 3, maxLength: 3000 },
  { key: "eligibilityText", label: "Điều kiện tham gia", kind: "textarea", rows: 3, maxLength: 3000 },
  { key: "exclusionsText", label: "Loại trừ / giới hạn", kind: "textarea", rows: 3, maxLength: 3000 },
  { key: "termsUrl", label: "Liên kết điều khoản chính thức", maxLength: 1000, placeholder: "https://…", half: true },
  { key: "updatedTermsAt", label: "Ngày cập nhật điều khoản", kind: "date", half: true },
];

export const FINANCE_PRODUCT_EMPTY: Values = {
  category: "ewa",
  title: "",
  subtitle: "",
  description: "",
  priceLabel: "",
  pricingSourceUrl: "",
  pricingEffectiveAt: "",
  benefitsSummary: "",
  eligibilityText: "",
  exclusionsText: "",
  termsUrl: "",
  updatedTermsAt: "",
};

export function financeProductToValues(product: Record<string, unknown>): Values {
  const category = textOf(product.category);
  return {
    category: FINANCE_CATEGORY_OPTIONS.some((option) => option.value === category) ? category : "ewa",
    title: textOf(product.title),
    subtitle: textOf(product.subtitle),
    description: textOf(product.description),
    priceLabel: textOf(product.price_label),
    pricingSourceUrl: textOf(product.pricing_source_url),
    pricingEffectiveAt: textOf(product.pricing_effective_at),
    benefitsSummary: textOf(product.benefits_summary),
    eligibilityText: textOf(product.eligibility_text),
    exclusionsText: textOf(product.exclusions_text),
    termsUrl: textOf(product.terms_url),
    updatedTermsAt: textOf(product.updated_terms_at),
  };
}

export function financeProductError(values: Values): string | null {
  if (!FINANCE_CATEGORY_OPTIONS.some((option) => option.value === values.category)) return "Chọn loại sản phẩm.";
  if (values.title.trim().length < 3) return "Tên sản phẩm tối thiểu 3 ký tự.";
  if (values.subtitle.trim().length > 160) return "Mô tả ngắn tối đa 160 ký tự.";
  if (values.description.trim().length < 20) return "Mô tả và phạm vi tư vấn tối thiểu 20 ký tự.";
  if (!values.priceLabel.trim()) return "Nhập phí/lãi theo tài liệu chính thức hoặc nêu rõ chưa có mức cụ thể.";
  if (values.priceLabel.trim().length > 240) return "Phí / lãi tối đa 240 ký tự.";
  const terms = values.termsUrl.trim();
  if (terms && !isHttpUrl(terms)) return "Liên kết điều khoản cần bắt đầu bằng http:// hoặc https://.";
  if (values.updatedTermsAt.trim() && !isValidDate(values.updatedTermsAt.trim())) return "Ngày cập nhật điều khoản chưa hợp lệ.";
  if (values.pricingEffectiveAt.trim() && !isValidDate(values.pricingEffectiveAt.trim())) return "Ngày hiệu lực phí/lãi chưa hợp lệ.";
  if (!values.pricingSourceUrl.trim() || !values.pricingEffectiveAt.trim()) return "Thông tin phí/lãi cần kèm liên kết căn cứ và ngày hiệu lực.";
  if (!isHttpUrl(values.pricingSourceUrl.trim())) return "Liên kết căn cứ phí/lãi không hợp lệ.";
  return null;
}

/** Hai trường ngày bỏ hẳn khi trống, đúng cách app làm (máy chủ không nhận chuỗi rỗng cho trường ngày). */
export function financeProductBody(values: Values): Record<string, unknown> {
  const body: Record<string, unknown> = { category: values.category };
  for (const key of ["title", "subtitle", "description", "priceLabel", "benefitsSummary", "eligibilityText", "exclusionsText", "termsUrl"]) {
    body[key] = (values[key] ?? "").trim();
  }
  for (const key of ["updatedTermsAt", "pricingSourceUrl", "pricingEffectiveAt"]) {
    const value = (values[key] ?? "").trim();
    if (value) body[key] = value;
  }
  return body;
}

export function financeProductMeta(product: Record<string, unknown>): string[] {
  const category = textOf(product.category);
  const label = FINANCE_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
  return [
    label,
    textOf(product.price_label),
    product.pricing_approved === true ? "Bảng giá đã duyệt" : "Bảng giá chưa duyệt (công nhân chưa thấy số tiền)",
  ].filter(Boolean);
}
