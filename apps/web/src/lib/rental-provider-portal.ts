// Cấu hình cổng tự phục vụ của Chủ trọ trên web: ô nhập, kiểm tra, dựng body gửi lên.
//
// BẢN SAO QUY TẮC CỦA APP (`utils/rentalListingForm.js`, `screens/partner/RentalProvider*.js`) và khớp schema của
// `api/rental-providers`, `api/mobile/rental-provider/profile` và `.../listings` (dùng chung `lib/rental-listing.ts`).
// Đổi một bên thì đổi cả hai.

import { PROVINCES } from "@/lib/provinces";
import {
  textOf,
  valuesMatch,
  type FieldDef,
  type StatusTone,
  type Values,
} from "@/lib/provider-portal-common";

const PROVINCE_OPTIONS = PROVINCES.map((province) => ({ value: province.code, label: province.name }));

export const RENTAL_PROVIDER_TYPES = [
  { value: "individual", label: "Cá nhân" },
  { value: "business", label: "Đơn vị" },
];

// ───────── Đăng ký ─────────

export const RENTAL_REGISTER_FIELDS: FieldDef[] = [
  { key: "providerName", label: "Tên chủ trọ / đơn vị *", maxLength: 160 },
  { key: "providerType", label: "Loại *", kind: "select", options: RENTAL_PROVIDER_TYPES },
  { key: "contactName", label: "Người phụ trách *", maxLength: 120, half: true },
  { key: "contactPhone", label: "Số điện thoại liên hệ *", kind: "tel", inputMode: "tel", maxLength: 20, half: true },
  { key: "email", label: "Email đăng nhập *", kind: "email", inputMode: "email", maxLength: 254, half: true },
  { key: "password", label: "Mật khẩu (tối thiểu 8 ký tự) *", kind: "password", maxLength: 128, half: true },
  { key: "provinceCode", label: "Tỉnh/thành", kind: "select", options: PROVINCE_OPTIONS, placeholder: "Chưa chọn" },
];

export const RENTAL_REGISTER_INITIAL: Values = {
  providerName: "",
  providerType: "individual",
  contactName: "",
  contactPhone: "",
  email: "",
  password: "",
  provinceCode: "",
};

export function rentalRegisterError(values: Values): string | null {
  if (values.providerName.trim().length < 2) return "Nhập tên chủ trọ hoặc đơn vị.";
  if (values.contactName.trim().length < 2) return "Nhập tên người phụ trách.";
  if (values.contactPhone.replace(/\D/g, "").length < 9) return "Số điện thoại liên hệ không hợp lệ.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return "Email đăng nhập chưa đúng định dạng.";
  if (values.password.length < 8) return "Mật khẩu tối thiểu 8 ký tự.";
  return null;
}

export function rentalRegisterBody(values: Values): Record<string, unknown> {
  return {
    providerName: values.providerName.trim(),
    providerType: values.providerType,
    contactName: values.contactName.trim(),
    contactPhone: values.contactPhone.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
    provinceCode: values.provinceCode.trim(),
  };
}

// ───────── Hồ sơ ─────────

export const RENTAL_PROFILE_FIELDS: FieldDef[] = [
  { key: "providerName", label: "Tên chủ trọ / đơn vị *", maxLength: 160 },
  { key: "providerType", label: "Loại *", kind: "select", options: RENTAL_PROVIDER_TYPES },
  { key: "contactName", label: "Người phụ trách *", maxLength: 120, half: true },
  { key: "contactPhone", label: "Số điện thoại *", kind: "tel", inputMode: "tel", maxLength: 20, half: true },
  { key: "provinceCode", label: "Tỉnh/thành", kind: "select", options: PROVINCE_OPTIONS, placeholder: "Chưa chọn" },
  { key: "address", label: "Địa chỉ", maxLength: 240 },
  { key: "description", label: "Giới thiệu", kind: "textarea", rows: 4, maxLength: 2000 },
];

export function rentalProfileToValues(profile: Record<string, unknown>): Values {
  const type = textOf(profile.provider_type);
  return {
    providerName: textOf(profile.provider_name),
    providerType: RENTAL_PROVIDER_TYPES.some((option) => option.value === type) ? type : "individual",
    contactName: textOf(profile.contact_name),
    contactPhone: textOf(profile.contact_phone),
    provinceCode: textOf(profile.province_code),
    address: textOf(profile.address),
    description: textOf(profile.description),
  };
}

export function rentalProfileError(values: Values): string | null {
  if (values.providerName.trim().length < 2) return "Nhập tên chủ trọ hoặc đơn vị.";
  if (values.contactName.trim().length < 2) return "Nhập tên người phụ trách.";
  if (values.contactPhone.replace(/\D/g, "").length < 9) return "Số điện thoại liên hệ không hợp lệ.";
  return null;
}

export function rentalProfileBody(values: Values): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of Object.keys(rentalProfileToValues({}))) body[key] = (values[key] ?? "").trim();
  return body;
}

export const rentalProfileMatches = (latest: Record<string, unknown>, sent: Values) =>
  valuesMatch(rentalProfileToValues(latest), sent);

// ───────── Tin cho thuê ─────────

export const LISTING_STATUSES = ["draft", "pending", "approved", "rejected", "hidden", "full"] as const;

export const LISTING_STATUS_LABEL: Record<string, string> = {
  draft: "Bản nháp",
  pending: "Chờ Admin duyệt",
  approved: "Đang công khai",
  rejected: "Bị từ chối",
  hidden: "Đã ẩn",
  full: "Hết phòng",
};

export const LISTING_STATUS_TONE: Record<string, StatusTone> = {
  draft: "gray",
  pending: "amber",
  approved: "green",
  rejected: "red",
  hidden: "gray",
  full: "blue",
};

export const LISTING_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "draft", label: "Nháp" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đang công khai" },
  { value: "rejected", label: "Từ chối" },
  { value: "hidden", label: "Đã ẩn" },
  { value: "full", label: "Hết phòng" },
];

/** Lựa chọn chọn nhanh, lấy từ `utils/rentalListingForm.js`. Máy chủ nhận chuỗi tự do nên chỉ đổi cách nhập. */
export const ROOM_TYPES = ["Phòng khép kín", "Phòng ghép", "Phòng đơn", "Phòng đôi", "Phòng trọ nữ", "Phòng trọ nam", "Phòng cao cấp", "Nhà nguyên căn"];
export const CAPACITY_OPTIONS = ["1", "2", "3", "4", "5", "6"];
export const AMENITY_OPTIONS = ["WC riêng", "WC chung", "Máy lạnh", "Quạt", "Wifi", "Tủ", "Tủ lạnh", "Bình nước nóng", "Giữ xe", "Bảo vệ 24/7", "Bếp riêng", "Giờ giấc tự do"];
export const RENT_QUICK_PICKS = [600000, 900000, 1200000, 1500000, 2000000];
export const AREA_QUICK_PICKS = [12, 15, 18, 20, 25];

/** Giới hạn ảnh của máy chủ (`listings/[id]/photos`). */
export const MAX_LISTING_PHOTOS = 12;
export const MAX_LISTING_PHOTO_BYTES = 4 * 1024 * 1024;
export const LISTING_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type ListingValues = {
  title: string;
  description: string;
  monthlyRentVnd: string;
  provinceCode: string;
  location: string;
  nearbyIndustrialZone: string;
  roomType: string;
  capacity: string;
  areaSqm: string;
  amenityPicks: string[];
  amenitiesText: string;
};

export const EMPTY_LISTING: ListingValues = {
  title: "",
  description: "",
  monthlyRentVnd: "",
  provinceCode: "",
  location: "",
  nearbyIndustrialZone: "",
  roomType: "",
  capacity: "",
  areaSqm: "",
  amenityPicks: [],
  amenitiesText: "",
};

/** Tách tiện ích đã lưu thành phần chọn sẵn và phần nhập thêm (giữ nguyên tiện ích cũ ngoài danh sách). */
export function splitAmenities(list: string[]): { picks: string[]; extra: string } {
  const picks: string[] = [];
  const extra: string[] = [];
  for (const item of list) (AMENITY_OPTIONS.includes(item) ? picks : extra).push(item);
  return { picks, extra: extra.join(", ") };
}

export function mergeAmenities(picks: string[], extraText: string): string[] {
  const extra = extraText
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set([...picks, ...extra])];
}

/** Đổi một tin đọc từ máy chủ về dạng form để sửa. */
export function listingToValues(listing: Record<string, unknown>): ListingValues {
  const num = (value: unknown) => (typeof value === "number" ? String(value) : "");
  const amenities = Array.isArray(listing.amenities) ? listing.amenities.filter((x): x is string => typeof x === "string") : [];
  const { picks, extra } = splitAmenities(amenities);
  return {
    title: textOf(listing.title),
    description: textOf(listing.description),
    monthlyRentVnd: num(listing.monthly_rent_vnd),
    provinceCode: textOf(listing.province_code),
    location: textOf(listing.location),
    nearbyIndustrialZone: textOf(listing.nearby_industrial_zone),
    roomType: textOf(listing.room_type),
    capacity: num(listing.capacity),
    areaSqm: num(listing.area_sqm),
    amenityPicks: picks,
    amenitiesText: extra,
  };
}

/** Kiểm tra giống app; trả null khi hợp lệ. Máy chủ vẫn là nơi quyết định. */
export function listingError(values: ListingValues): string | null {
  const rent = Number(values.monthlyRentVnd);
  if (
    values.title.trim().length < 5 ||
    values.description.trim().length < 20 ||
    !values.monthlyRentVnd.trim() ||
    !Number.isSafeInteger(rent) ||
    rent < 0 ||
    !values.provinceCode.trim() ||
    values.location.trim().length < 3
  ) {
    return "Điền tiêu đề (5 ký tự trở lên), mô tả tối thiểu 20 ký tự, giá thuê, tỉnh/thành và địa điểm hợp lệ.";
  }
  const area = values.areaSqm.trim();
  if (area && (!Number.isFinite(Number(area)) || Number(area) <= 0)) return "Diện tích phải là số lớn hơn 0.";
  return null;
}

/**
 * Dựng body gửi lên `listings` (POST) hoặc `listings/[id]` (PATCH).
 *
 * `action` LUÔN được gửi, đúng như app: máy chủ KHÔNG tự đưa tin về "chờ duyệt" khi sửa nội dung (khác Y tế và
 * Học nghề), nên quy tắc "sửa tin công khai phải qua duyệt lại" do chính client giữ. `draft` đưa tin về nháp,
 * `submit` gửi Admin duyệt; không gửi action thì tin đang công khai sẽ giữ nguyên trạng thái dù nội dung đã đổi.
 */
export function listingBody(values: ListingValues, action: "draft" | "submit"): Record<string, unknown> {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    monthlyRentVnd: Number(values.monthlyRentVnd),
    areaSqm: values.areaSqm.trim() ? Number(values.areaSqm) : null,
    provinceCode: values.provinceCode.trim(),
    location: values.location.trim(),
    roomType: values.roomType.trim(),
    capacity: values.capacity.trim() ? Number(values.capacity) : null,
    nearbyIndustrialZone: values.nearbyIndustrialZone.trim(),
    amenities: mergeAmenities(values.amenityPicks, values.amenitiesText),
    action,
  };
}

/** So sánh hai danh sách ảnh theo đúng thứ tự. */
export function sameUrls(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((url, index) => url === b[index]);
}

// ───────── Yêu cầu thuê ─────────

/** Chủ trọ chỉ đổi qua ba trạng thái này; không có "Đang tư vấn" như Bảo hiểm và Tài chính. */
export const RENTAL_INQUIRY_LABEL: Record<string, string> = {
  new: "Mới",
  contacted: "Đã liên hệ",
  resolved: "Đã xử lý",
  cancelled: "Đã hủy",
};

export const RENTAL_INQUIRY_TONE: Record<string, StatusTone> = {
  new: "amber",
  contacted: "blue",
  resolved: "green",
  cancelled: "red",
};
