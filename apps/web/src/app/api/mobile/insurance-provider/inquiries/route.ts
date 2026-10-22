import { NextRequest, NextResponse } from "next/server";
import { getInsuranceProviderSession } from "@/lib/insurance-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

type ProductRelation = { title: string } | Array<{ title: string }> | null;
type InquiryRow = Record<string, unknown> & { insurance_products: ProductRelation };
export async function GET(request: NextRequest) {
  const session = await getInsuranceProviderSession(); if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  let paging; try { paging = parseEmployerListParams(request.nextUrl.searchParams, ["new", "contacted", "advising", "resolved", "cancelled"]); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số danh sách không hợp lệ." }, { status: 400 }); }
  const params = request.nextUrl.searchParams; const id = params.get("id") || "";
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã yêu cầu không hợp lệ." }, { status: 400 });
  let query = createSupabaseAdminClient().from("insurance_inquiries")
    .select("id,product_id,full_name,message,status,contact_consent,created_at,insurance_products(title)", { count: "exact" })
    .eq("provider_id", session.providerId).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (id) query = query.eq("id", id); if (paging.status) query = query.eq("status", paging.status);
  const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._(),]/g, " ");
  if (q) query = query.or(`full_name.ilike.%${q}%,message.ilike.%${q}%`);
  const { data, count, error } = await query.range((paging.page - 1) * paging.pageSize, paging.page * paging.pageSize - 1);
  if (error) { const requestId = logSafeSupabaseError({ route: "/api/mobile/insurance-provider/inquiries", operation: "list_inquiries", error }); return NextResponse.json({ error: "Chưa tải được yêu cầu tư vấn.", requestId }, { status: 503, headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store" } }); }
  const items = ((data || []) as unknown as InquiryRow[]).map(({ insurance_products, ...inquiry }) => ({ ...inquiry, product_title: Array.isArray(insurance_products) ? insurance_products[0]?.title : insurance_products?.title }));
  const total = count || 0; return NextResponse.json({ ok: true, items, total, page: paging.page, pageSize: paging.pageSize, hasMore: paging.page * paging.pageSize < total }, { headers: { "Cache-Control": "private, no-store" } });
}
