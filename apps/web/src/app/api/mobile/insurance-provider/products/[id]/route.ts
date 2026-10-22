import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getInsuranceProviderSession } from "@/lib/insurance-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isInsuranceProviderUnverifiedError, logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({ category: z.enum(["bhxh_voluntary", "bhyt", "accident", "health", "other"]), title: z.string().trim().min(3).max(160), subtitle: z.string().trim().max(160).optional(), description: z.string().trim().min(20).max(10000), priceLabel: z.string().trim().max(240).optional(), benefitsSummary: z.string().trim().max(3000).optional(), eligibilityText: z.string().trim().max(3000).optional(), exclusionsText: z.string().trim().max(3000).optional(), termsUrl: z.string().url().max(1000).optional().or(z.literal("")), updatedTermsAt: z.string().date().optional() });
const toRow = (input: z.infer<typeof schema>) => ({ category: input.category, title: input.title, subtitle: input.subtitle || null, description: input.description, price_label: input.priceLabel || null, benefits_summary: input.benefitsSummary || null, eligibility_text: input.eligibilityText || null, exclusions_text: input.exclusionsText || null, terms_url: input.termsUrl || null, updated_terms_at: input.updatedTermsAt || null });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getInsuranceProviderSession(); if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { id } = await context.params; if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã sản phẩm không hợp lệ." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin sản phẩm không hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: owned, error: ownedError } = await supabase.from("insurance_products").select("id,status").eq("id", id).eq("provider_id", session.providerId).maybeSingle();
  if (ownedError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/insurance-provider/products/[id]", operation: "check_ownership", error: ownedError }); return NextResponse.json({ error: "Chưa xác minh được quyền sửa sản phẩm.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  if (!owned) return NextResponse.json({ error: "Không tìm thấy sản phẩm của đối tác." }, { status: 404 });
  const { data: provider, error: providerError } = await supabase.from("insurance_providers").select("is_verified").eq("id", session.providerId).maybeSingle();
  if (providerError || !provider) { const requestId = providerError ? logSafeSupabaseError({ route: "/api/mobile/insurance-provider/products/[id]", operation: "check_provider", error: providerError }) : undefined; return NextResponse.json({ error: "Chưa xác minh được hồ sơ đối tác.", ...(requestId ? { requestId } : {}) }, { status: 503 }); }
  const nextStatus = provider.is_verified ? "pending" : "draft";
  const { data, error } = await supabase.from("insurance_products").update({ ...toRow(parsed.data), status: nextStatus, rejection_reason: null, updated_at: new Date().toISOString() }).eq("id", id).eq("provider_id", session.providerId).select("id,status,title").maybeSingle();
  if (error) { if (isInsuranceProviderUnverifiedError(error)) return NextResponse.json({ error: "Đối tác cần được Admin xác minh trước khi gửi sản phẩm." }, { status: 403 }); const requestId = logSafeSupabaseError({ route: "/api/mobile/insurance-provider/products/[id]", operation: "update_product", error }); return NextResponse.json({ error: "Chưa cập nhật được sản phẩm.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  if (!data) return NextResponse.json({ error: "Không tìm thấy sản phẩm của đối tác." }, { status: 404 });
  return NextResponse.json({ ok: true, product: data });
}
