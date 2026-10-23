import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFinanceProviderSession } from "@/lib/finance-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { isFinanceProviderUnverifiedError, logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({
  category: z.enum(["ewa", "consumer_loan", "remittance"]),
  title: z.string().trim().min(3).max(160), subtitle: z.string().trim().max(160).optional(),
  description: z.string().trim().min(20).max(10000), priceLabel: z.string().trim().min(1).max(240),
  benefitsSummary: z.string().trim().max(3000).optional(), eligibilityText: z.string().trim().max(3000).optional(),
  exclusionsText: z.string().trim().max(3000).optional(), termsUrl: z.string().url().max(1000).optional().or(z.literal("")),
  updatedTermsAt: z.string().date().optional(), pricingSourceUrl: z.string().url().max(1000),
  pricingEffectiveAt: z.string().date(),
});
const toRow = (input: z.infer<typeof schema>) => ({
  category: input.category, title: input.title, subtitle: input.subtitle || null, description: input.description,
  price_label: input.priceLabel || null, benefits_summary: input.benefitsSummary || null,
  eligibility_text: input.eligibilityText || null, exclusions_text: input.exclusionsText || null,
  terms_url: input.termsUrl || null, updated_terms_at: input.updatedTermsAt || null,
  pricing_source_url: input.pricingSourceUrl || null, pricing_effective_at: input.pricingEffectiveAt || null,
});

export async function GET(request: NextRequest) {
  const session = await getFinanceProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  let paging;
  try { paging = parseEmployerListParams(request.nextUrl.searchParams, ["draft", "pending", "approved", "rejected", "hidden"]); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số phân trang không hợp lệ." }, { status: 400 }); }
  const { page, pageSize, status } = paging; const params = request.nextUrl.searchParams;
  let query = createSupabaseAdminClient().from("finance_products").select("*", { count: "exact" })
    .eq("provider_id", session.providerId).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (status) query = query.eq("status", status);
  const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._(),]/g, " ");
  if (q) query = query.or(`title.ilike.%${q}%,category.ilike.%${q}%`);
  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) { const requestId = logSafeSupabaseError({ route: "/api/mobile/finance-provider/products", operation: "list_products", error }); return NextResponse.json({ error: "Chưa tải được danh sách sản phẩm.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  const total = count || 0;
  return NextResponse.json({ ok: true, items: data || [], total, page, pageSize, hasMore: page * pageSize < total });
}

export async function POST(request: NextRequest) {
  const session = await getFinanceProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin sản phẩm không hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: provider, error: providerError } = await supabase.from("finance_providers").select("is_verified").eq("id", session.providerId).maybeSingle();
  if (providerError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/finance-provider/products", operation: "check_provider", error: providerError }); return NextResponse.json({ error: "Chưa xác định được quyền gửi sản phẩm.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  if (!provider) return NextResponse.json({ error: "Không tìm thấy hồ sơ đối tác." }, { status: 404 });
  const status = provider.is_verified ? "pending" : "draft";
  const { data, error } = await supabase.from("finance_products").insert({ ...toRow(parsed.data), provider_id: session.providerId, status, pricing_approved: false }).select("id,status,title").single();
  if (error) {
    if (isFinanceProviderUnverifiedError(error)) return NextResponse.json({ error: "Đối tác cần được Admin xác minh trước khi gửi sản phẩm." }, { status: 403 });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/finance-provider/products", operation: "create_product", error });
    return NextResponse.json({ error: "Chưa lưu được sản phẩm tài chính.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, product: data }, { status: 201 });
}
