import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";

type ProviderRow = { id: string; provider_name: string; provider_type: string; contact_name: string; contact_phone: string; province_code: string | null; tax_code: string | null; license_number: string | null; is_verified: boolean; contact_view_limit: number; account_type: string; account_tier_expires_at: string | null; created_at: string; users: { email: string } | Array<{ email: string }> };
export async function GET(request: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  let paging; try { paging = parseEmployerListParams(request.nextUrl.searchParams, []); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số phân trang không hợp lệ." }, { status: 400 }); }
  const params = request.nextUrl.searchParams; const verified = params.get("verified");
  if (verified !== null && verified !== "true" && verified !== "false") return NextResponse.json({ error: "Giá trị lọc xác minh không hợp lệ." }, { status: 400 });
  let query = createSupabaseAdminClient().from("insurance_providers").select("id,provider_name,provider_type,contact_name,contact_phone,province_code,tax_code,license_number,is_verified,contact_view_limit,account_type,account_tier_expires_at,created_at,users!insurance_providers_user_id_fkey!inner(email)", { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (verified) query = query.eq("is_verified", verified === "true");
  const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._(),]/g, " "); if (q) query = query.or(`provider_name.ilike.%${q}%,contact_phone.ilike.%${q}%`);
  const { data, count, error } = await query.range((paging.page - 1) * paging.pageSize, paging.page * paging.pageSize - 1);
  if (error) { const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/insurance-providers", operation: "list_providers", error }); return NextResponse.json({ error: "Chưa tải được danh sách đối tác bảo hiểm.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  const items = ((data || []) as unknown as ProviderRow[]).map(({ users, ...provider }) => ({ ...provider, email: Array.isArray(users) ? users[0]?.email : users.email }));
  const total = count || 0; return NextResponse.json({ ok: true, items, total, page: paging.page, pageSize: paging.pageSize, hasMore: paging.page * paging.pageSize < total }, { headers: { "Cache-Control": "private, no-store" } });
}
