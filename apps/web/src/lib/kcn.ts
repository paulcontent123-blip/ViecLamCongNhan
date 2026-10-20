import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { KcnRow } from "@/types/db";

/**
 * kcn.active_jobs (seed) là số tĩnh, dễ lệch với dữ liệu jobs thật. Ở đây tính lại
 * live theo COUNT(jobs đã duyệt) để tránh hiển thị sai số lượng tin ‑ đây là lỗi
 * logic đã sửa so với bản HTML demo cũ (số liệu hard-code không bao giờ đổi).
 */
export async function getKcnList(province?: string): Promise<KcnRow[]> {
  const supabase = await createSupabaseServerClient();

  let kcnQuery = supabase.from("kcn").select("*").order("province_name", { ascending: true });
  if (province) kcnQuery = kcnQuery.eq("province_code", province);
  const { data: kcnRows, error: kcnError } = await kcnQuery;
  if (kcnError || !kcnRows) {
    console.error("getKcnList error:", kcnError?.message);
    return [];
  }

  const { data: jobRows } = await supabase
    .from("jobs")
    .select("kcn_id")
    .eq("status", "approved")
    .not("kcn_id", "is", null);

  const counts = new Map<string, number>();
  for (const row of jobRows ?? []) {
    const kcnId = (row as { kcn_id: string }).kcn_id;
    counts.set(kcnId, (counts.get(kcnId) ?? 0) + 1);
  }

  return kcnRows.map((kcn) => ({ ...kcn, active_jobs: counts.get(kcn.id) ?? 0 }));
}

export async function getKcnById(id: string): Promise<KcnRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("kcn").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data;
}
