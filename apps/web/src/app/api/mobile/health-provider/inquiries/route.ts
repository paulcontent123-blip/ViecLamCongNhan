import { NextRequest, NextResponse } from "next/server";
import { getHealthProviderSession } from "@/lib/health-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
export async function GET(request: NextRequest) {
  const session = await getHealthProviderSession(); if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  let paging; try { paging = parseEmployerListParams(request.nextUrl.searchParams, ["new", "contacted", "appointment_confirmed", "completed", "cancelled"]); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số danh sách không hợp lệ." }, { status: 400 }); }
  const params = request.nextUrl.searchParams; let query = createSupabaseAdminClient().from("health_inquiries").select("id,service_id,full_name,desired_date,preferred_time,contact_consent,status,created_at,health_services(title,category)", { count: "exact" }).eq("provider_id", session.providerId).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (paging.status) query = query.eq("status", paging.status);
  const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._(),]/g, " "); if (q) query = query.or(`full_name.ilike.%${q}%`);
  const { data, count, error } = await query.range((paging.page - 1) * paging.pageSize, paging.page * paging.pageSize - 1);
  if (error) { const requestId = logSafeSupabaseError({ route: "/api/mobile/health-provider/inquiries", operation: "list_inquiries", error }); return NextResponse.json({ error: "Chưa tải được yêu cầu liên hệ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store" } }); }
  const items = (data || []).map(({ health_services, ...inquiry }) => ({ ...inquiry, service: Array.isArray(health_services) ? health_services[0] : health_services }));
  const total = count || 0; return NextResponse.json({ ok: true, items, total, page: paging.page, pageSize: paging.pageSize, hasMore: paging.page * paging.pageSize < total }, { headers: { "Cache-Control": "private, no-store" } });
}
