import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
type ProductRow = Record<string, unknown> & { insurance_providers: { provider_name: string; is_verified: boolean } | Array<{ provider_name: string; is_verified: boolean }> | null };
export async function GET(request: NextRequest) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  let paging; try { paging = parseEmployerListParams(request.nextUrl.searchParams, ["draft", "pending", "approved", "rejected", "hidden"]); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số phân trang không hợp lệ." }, { status: 400 }); }
  let query = createSupabaseAdminClient().from("insurance_products").select("*,insurance_providers!inner(provider_name,is_verified)", { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (paging.status) query = query.eq("status", paging.status);
  const q = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100).replace(/[%,._(),]/g, " "); if (q) query = query.or(`title.ilike.%${q}%,category.ilike.%${q}%`);
  const { data, count, error } = await query.range((paging.page - 1) * paging.pageSize, paging.page * paging.pageSize - 1);
  if (error) { const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/insurance-products", operation: "list_products", error }); return NextResponse.json({ error: "Chưa tải được sản phẩm bảo hiểm.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  const items = ((data || []) as unknown as ProductRow[]).map(({ insurance_providers, ...product }) => ({ ...product, provider: Array.isArray(insurance_providers) ? insurance_providers[0] : insurance_providers }));
  const total = count || 0; return NextResponse.json({ ok: true, items, total, page: paging.page, pageSize: paging.pageSize, hasMore: paging.page * paging.pageSize < total }, { headers: { "Cache-Control": "private, no-store" } });
}
