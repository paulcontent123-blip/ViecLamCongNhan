import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PROVINCES } from "@/lib/provinces";

export interface HomeStats {
  approvedJobs: number;
  employers: number;
  candidates: number;
  kcn: number;
  revenuePartners: number;
  provinces: number;
  salaryMinM: number;
  salaryMaxM: number;
}

/**
 * Số liệu hero/stats trang chủ tính trực tiếp từ dữ liệu thật — khác bản HTML demo
 * cũ dùng số cố định (48.000+ tin, 1.200+ nhà máy, 800K+ ứng viên) không bao giờ đổi.
 * Dùng service-role client (bypass RLS) vì candidates không có policy đọc công khai
 * (đúng chủ đích — bảo vệ SĐT/thông tin ứng viên) nên client anon sẽ luôn đếm ra 0;
 * ở đây chỉ trả về SỐ ĐẾM tổng hợp, không lộ dữ liệu thô của từng ứng viên.
 */
export async function getHomeStats(): Promise<HomeStats> {
  const supabase = createSupabaseAdminClient();

  const [jobsRes, employersRes, candidatesRes, kcnRes, revenuePartnersRes, salaryRes] = await Promise.all([
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("employers").select("id", { count: "exact", head: true }),
    supabase.from("candidates").select("id", { count: "exact", head: true }),
    supabase.from("kcn").select("id", { count: "exact", head: true }),
    supabase.from("revenue_partners").select("id", { count: "exact", head: true }),
    supabase.from("jobs").select("salary_min, salary_max").eq("status", "approved"),
  ]);

  const mins = (salaryRes.data ?? []).map((r) => r.salary_min).filter((v): v is number => v != null);
  const maxs = (salaryRes.data ?? []).map((r) => r.salary_max).filter((v): v is number => v != null);
  const salaryMinM = mins.length ? Math.floor(Math.min(...mins) / 1_000_000) : 0;
  const salaryMaxM = maxs.length ? Math.ceil(Math.max(...maxs) / 1_000_000) : 0;

  return {
    approvedJobs: jobsRes.count ?? 0,
    employers: employersRes.count ?? 0,
    candidates: candidatesRes.count ?? 0,
    kcn: kcnRes.count ?? 0,
    revenuePartners: revenuePartnersRes.count ?? 0,
    provinces: PROVINCES.length,
    salaryMinM,
    salaryMaxM,
  };
}
