import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const params = request.nextUrl.searchParams;
  let paging;
  try { paging = parseEmployerListParams(params, []); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số phân trang không hợp lệ." }, { status: 400 }); }
  const { page, pageSize } = paging;
  const q = (params.get("q") || "").trim().slice(0, 100);
  const verified = params.get("verified");
  const id = params.get("id") || "";
  if (verified !== null && verified !== "true" && verified !== "false") return NextResponse.json({ error: "Giá trị lọc xác minh không hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("training_providers").select("id,provider_name,provider_type,contact_name,contact_phone,province_code,tax_code,license_number,is_verified,account_type,created_at,users!inner(email)", { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (id) query = query.eq("id", id);
  if (verified === "true") query = query.eq("is_verified", true);
  if (verified === "false") query = query.eq("is_verified", false);
  if (q) { const safeQ = q.replace(/[%,._(),]/g, " "); query = query.or(`provider_name.ilike.%${safeQ}%,contact_phone.ilike.%${safeQ}%`); }
  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return NextResponse.json({ error: "Chưa tải được danh sách đơn vị đào tạo." }, { status: 500 });
  const items = (data || []).map((item: any) => ({ ...item, email: Array.isArray(item.users) ? item.users[0]?.email : item.users?.email, users: undefined }));
  const total = count || 0;
  return NextResponse.json({ ok: true, items, total, page, pageSize, hasMore: page * pageSize < total });
}
