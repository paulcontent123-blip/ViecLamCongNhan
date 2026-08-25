// Type thủ công khớp supabase/migrations (không dùng `supabase gen types` được vì
// môi trường này không có Docker để CLI introspect qua --db-url).

export interface JobRow {
  id: string;
  employer_id: string | null;
  slug: string;
  title: string;
  description: string;
  requirements: string | null;
  salary_min: number | null;
  salary_max: number | null;
  job_type: "full_time" | "part_time" | "seasonal" | null;
  province_code: string;
  district: string | null;
  kcn_id: string | null;
  industry: string;
  quantity: number;
  tier: "free" | "basic" | "premium" | "campaign";
  status: "pending" | "approved" | "closed" | "expired";
  sms_blast_sent: boolean;
  view_count: number;
  apply_count: number;
  expires_at: string | null;
  created_at: string;
  is_urgent: boolean;
  has_housing: boolean;
  has_shuttle: boolean;
  has_meals: boolean;
  no_experience_required: boolean;
  shift_type: "day" | "night" | "rotating" | null;
  campaign_theme: string;
  campaign_story: string | null;
}

export interface JobWithRelations extends JobRow {
  employers: { company_name: string; company_logo_url: string | null } | null;
  kcn: { name: string } | null;
}

export interface KcnRow {
  id: string;
  name: string;
  province_code: string;
  province_name: string;
  address: string | null;
  total_area_ha: number | null;
  occupied_pct: number | null;
  active_companies: number;
  active_jobs: number;
  industries: string[] | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface ServiceInquiryRow {
  id: string;
  type: string;
  service_name: string;
  company_name: string;
  phone: string;
  phone_normalized: string;
  email: string;
  request: string;
  kcn_target: string | null;
  cancel_reason: string | null;
  status: "new" | "consulted" | "cancelled";
  created_at: string;
  consulted_at: string | null;
}

export interface KcnAdCardRow {
 id: string;
 icon: string;
 icon_bg: string;
 title: string;
 category: string;
 tag: string;
 tag_tone: string;
 description: string;
 package_lines: string[];
 cta_label: string;
 sort_order: number;
 is_active: boolean;
 created_at: string;
 updated_at: string;
}

export interface ServicePackageCardRow {
  id: string;
  icon: string;
  title: string;
  description: string;
  features: string[];
  price: string;
  cta_label: string;
  accent: "orange" | "green" | "amber" | "red" | "full";
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServicePartnerCardRow {
  id: string;
  icon: string;
  icon_bg: string;
  title: string;
  category: string;
  tag: string;
  tag_tone: string;
  description: string;
  package_lines: string[];
  cta_label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdvertisingPricingCardRow {
  id: string;
  format: string;
  placement: string;
  price: string;
  unit: string;
  cta_label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
