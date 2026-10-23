import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
const categories = ["consultation", "examination", "screening"] as const;
type Provider = { id: string; provider_name: string; provider_type: string; logo_url: string | null; province_code: string | null; address: string | null; is_verified: boolean };
export async function GET(request: NextRequest) {
  let paging; try { paging = parseEmployerListParams(request.nextUrl.searchParams, []); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số danh sách không hợp lệ." }, { status: 400 }); }
  const params = request.nextUrl.searchParams; const category = params.get("category") || "";
  if (category && !z.enum(categories).safeParse(category).success) return NextResponse.json({ error: "Loại dịch vụ không hợp lệ." }, { status: 400 });
  const province = (params.get("province") || "").trim().slice(0, 32); const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._(),]/g, " "); const supabase = createSupabaseAdminClient();
  let query = supabase.from("health_services").select("id,provider_id,category,title,specialty,description,price_label,address,province_code,opening_hours,accepts_bhyt,published_at,health_providers!inner(id,provider_name,provider_type,logo_url,province_code,address,is_verified)", { count: "exact" }).eq("status", "approved").is("archived_at", null).eq("health_providers.is_verified", true).order("published_at", { ascending: false }).order("id", { ascending: false });
  if (category) query = query.eq("category", category); if (province) query = query.eq("province_code", province);
  if (q) query = query.or(`title.ilike.%${q}%,specialty.ilike.%${q}%,description.ilike.%${q}%`);
  const { data, count, error } = await query.range((paging.page - 1) * paging.pageSize, paging.page * paging.pageSize - 1);
  if (error) { const requestId = logSafeSupabaseError({ route: "/api/mobile/health/services", operation: "list_public_services", error }); return NextResponse.json({ error: "Chưa tải được danh sách dịch vụ y tế.", requestId }, { status: 503, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } }); }
  const items = (data || []).map(({ health_providers, ...service }) => ({ ...service, provider: (Array.isArray(health_providers) ? health_providers[0] : health_providers) as Provider | null }));
  const total = count || 0; return NextResponse.json({ ok: true, items, total, page: paging.page, pageSize: paging.pageSize, hasMore: paging.page * paging.pageSize < total }, { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" } });
}
