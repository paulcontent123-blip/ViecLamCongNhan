// Hình dạng dữ liệu các route `api/mobile/*` công khai trả về cho khu Dịch vụ công nhân.
// Chỉ khai báo những trường mà route thực sự chọn (xem `select(...)` trong từng route) ‑ thêm trường ở đây
// mà route không trả thì giao diện sẽ hiện trống.

export type VocationalCourse = {
  id: string;
  title: string;
  occupation: string | null;
  level: string | null;
  learning_mode: string | null;
  province_code: string | null;
  location: string | null;
  start_date: string | null;
  duration_text: string | null;
  tuition_vnd: number | null;
  support_description: string | null;
  certificate_name: string | null;
  certificate_issuer: string | null;
  capacity: number | null;
  enrollment_deadline: string | null;
  description: string | null;
  requirements: string | null;
  created_at: string;
  /** Route gộp từ quan hệ `training_providers`; chỉ đơn vị đã xác minh mới có tin ở đây. */
  provider_name?: string | null;
};

export type RentalListing = {
  id: string;
  title: string;
  description: string | null;
  monthly_rent_vnd: number | null;
  area_sqm: number | null;
  province_code: string | null;
  location: string | null;
  room_type: string | null;
  capacity: number | null;
  nearby_industrial_zone: string | null;
  amenities: string[] | null;
  photo_urls: string[] | null;
  published_at: string | null;
  created_at: string;
  provider_name?: string | null;
};

/** Đơn vị kèm theo sản phẩm bảo hiểm, tài chính và dịch vụ y tế. */
export type ServiceProvider = {
  id?: string;
  provider_name: string | null;
  provider_type?: string | null;
  logo_url: string | null;
  province_code: string | null;
  address?: string | null;
  is_verified: boolean;
};

export type InsuranceProduct = {
  id: string;
  provider_id: string;
  category: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  price_label: string | null;
  benefits_summary: string | null;
  eligibility_text: string | null;
  exclusions_text: string | null;
  terms_url: string | null;
  updated_terms_at: string | null;
  published_at: string | null;
  provider: ServiceProvider | null;
};

export type FinanceProduct = {
  id: string;
  provider_id: string;
  category: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  /** Route ẩn giá khi bảng giá chưa được duyệt, nên trường này có thể null dù sản phẩm đã duyệt. */
  price_label: string | null;
  pricing_approved: boolean;
  pricing_source_url: string | null;
  pricing_effective_at: string | null;
  benefits_summary: string | null;
  eligibility_text: string | null;
  exclusions_text: string | null;
  terms_url: string | null;
  updated_terms_at: string | null;
  published_at: string | null;
  provider: ServiceProvider | null;
};

export type HealthService = {
  id: string;
  provider_id: string;
  category: string;
  title: string;
  specialty: string | null;
  description: string | null;
  price_label: string | null;
  address: string | null;
  province_code: string | null;
  opening_hours: string | null;
  accepts_bhyt: boolean | null;
  published_at: string | null;
  provider: ServiceProvider | null;
};
