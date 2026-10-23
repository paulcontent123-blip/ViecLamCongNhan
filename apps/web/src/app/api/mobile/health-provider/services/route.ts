import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getHealthProviderSession } from "@/lib/health-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({ category: z.enum(["consultation", "examination", "screening"]), title: z.string().trim().min(3).max(160), specialty: z.string().trim().max(100).optional(), description: z.string().trim().min(20).max(5000), priceLabel: z.string().trim().max(200).optional(), address: z.string().trim().max(300).optional(), provinceCode: z.string().trim().max(32).optional(), openingHours: z.string().trim().max(200).optional(), acceptsBhyt: z.boolean().default(false), submitForReview: z.boolean().default(false) });
const row = (input: z.infer<typeof schema>) => ({ category: input.category, title: input.title, specialty: input.specialty || null, description: input.description, price_label: input.priceLabel || null, address: input.address || null, province_code: input.provinceCode || null, opening_hours: input.openingHours || null, accepts_bhyt: input.acceptsBhyt });
const unavailable = (error: unknown) => String((error as { message?: string })?.message || "").includes("HEALTH_PROVIDER_UNVERIFIED");

export async function GET(request: NextRequest) {
  const session = await getHealthProviderSession(); if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  let paging; try { paging = parseEmployerListParams(request.nextUrl.searchParams, ["draft", "pending", "approved", "rejected", "hidden"]); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số danh sách không hợp lệ." }, { status: 400 }); }
  const params = request.nextUrl.searchParams; let query = createSupabaseAdminClient().from("health_services").select("*", { count: "exact" }).eq("provider_id", session.providerId).is("archived_at", null).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (paging.status) query = query.eq("status", paging.status);
  const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._(),]/g, " "); if (q) query = query.or(`title.ilike.%${q}%,specialty.ilike.%${q}%`);
  const { data, count, error } = await query.range((paging.page - 1) * paging.pageSize, paging.page * paging.pageSize - 1);
  if (error) { const requestId = logSafeSupabaseError({ route: "/api/mobile/health-provider/services", operation: "list_services", error }); return NextResponse.json({ error: "Chưa tải được danh sách dịch vụ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store" } }); }
  const total = count || 0; return NextResponse.json({ ok: true, items: data || [], total, page: paging.page, pageSize: paging.pageSize, hasMore: paging.page * paging.pageSize < total }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const session = await getHealthProviderSession(); if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin dịch vụ không hợp lệ." }, { status: 400 });
  const input = parsed.data; const supabase = createSupabaseAdminClient();
  const { data: provider, error: providerError } = await supabase.from("health_providers").select("is_verified").eq("id", session.providerId).maybeSingle();
  if (providerError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/health-provider/services", operation: "check_provider", error: providerError }); return NextResponse.json({ error: "Chưa xác định được quyền gửi dịch vụ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  if (!provider) return NextResponse.json({ error: "Không tìm thấy hồ sơ cơ sở y tế." }, { status: 404 });
  if (input.submitForReview && !provider.is_verified) return NextResponse.json({ error: "Cơ sở cần được Admin xác minh trước khi gửi dịch vụ duyệt." }, { status: 403 });
  const status = input.submitForReview ? "pending" : "draft";
  const { data, error } = await supabase.from("health_services").insert({ ...row(input), provider_id: session.providerId, status }).select("id,status,title,updated_at").single();
  if (error) { if (unavailable(error)) return NextResponse.json({ error: "Cơ sở cần được Admin xác minh trước khi gửi dịch vụ duyệt." }, { status: 403 }); const requestId = logSafeSupabaseError({ route: "/api/mobile/health-provider/services", operation: "create_service", error }); return NextResponse.json({ error: "Chưa lưu được dịch vụ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  return NextResponse.json({ ok: true, service: data }, { status: 201 });
}
