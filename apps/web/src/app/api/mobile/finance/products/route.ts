import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const categories = ["ewa", "consumer_loan", "remittance"] as const;
export async function GET(request: NextRequest) {
  let paging; try { paging = parseEmployerListParams(request.nextUrl.searchParams, []); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số phân trang không hợp lệ." }, { status: 400 }); }
  const params = request.nextUrl.searchParams; const category = params.get("category") || "";
  if (category && !z.enum(categories).safeParse(category).success) return NextResponse.json({ error: "Loại sản phẩm không hợp lệ." }, { status: 400 });
  const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._(),]/g, " "); const supabase = createSupabaseAdminClient();
  let query = supabase.from("finance_products").select("id,provider_id,category,title,subtitle,description,price_label,pricing_approved,pricing_source_url,pricing_effective_at,benefits_summary,eligibility_text,exclusions_text,terms_url,updated_terms_at,published_at,finance_providers!inner(provider_name,logo_url,province_code,is_verified)", { count: "exact" })
    .eq("status", "approved").eq("pricing_approved", true).is("archived_at", null).eq("finance_providers.is_verified", true).order("published_at", { ascending: false }).order("id", { ascending: false });
  if (category) query = query.eq("category", category);
  if (q) query = query.or(`title.ilike.%${q}%,subtitle.ilike.%${q}%,description.ilike.%${q}%`);
  const { data, count, error } = await query.range((paging.page - 1) * paging.pageSize, paging.page * paging.pageSize - 1);
  if (error) { const requestId = logSafeSupabaseError({ route: "/api/mobile/finance/products", operation: "list_public_products", error }); return NextResponse.json({ error: "Chưa tải được danh sách sản phẩm tài chính.", requestId }, { status: 503, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } }); }
  const items = (data || []).map(({ finance_providers, ...product }) => ({
    ...product,
    price_label: product.pricing_approved ? product.price_label : null,
    pricing_source_url: product.pricing_approved ? product.pricing_source_url : null,
    pricing_effective_at: product.pricing_approved ? product.pricing_effective_at : null,
    provider: Array.isArray(finance_providers) ? finance_providers[0] : finance_providers,
  }));
  const total = count || 0;
  return NextResponse.json({ ok: true, items, total, page: paging.page, pageSize: paging.pageSize, hasMore: paging.page * paging.pageSize < total }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } });
}
