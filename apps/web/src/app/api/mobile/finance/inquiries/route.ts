import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({ productId: z.string().uuid(), topic: z.string().trim().min(2).max(40), fullName: z.string().trim().min(2).max(120), phone: z.string().trim().min(9).max(20).refine(value => { const digits = value.replace(/\D/g, "").length; return digits >= 9 && digits <= 15; }, "Số điện thoại không hợp lệ."), email: z.string().trim().email().max(254).optional().or(z.literal("")), provinceCode: z.string().trim().max(32).optional().or(z.literal("")), destinationProvinceCode: z.string().trim().max(32).optional().or(z.literal("")), message: z.string().trim().max(1000).optional(), contactConsent: z.literal(true) });
const TOPICS: Record<string, string[]> = {
  ewa: ["eligibility", "fees", "registration"],
  consumer_loan: ["eligibility", "costs", "repayment"],
  remittance: ["coverage", "fees_exchange", "receiving"],
};
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin yêu cầu không hợp lệ." }, { status: 400 });
  const input = parsed.data; const supabase = createSupabaseAdminClient();
  const { data: product, error: productError } = await supabase.from("finance_products").select("id,provider_id,category,title,status,finance_providers!inner(provider_name,is_verified)").eq("id", input.productId).maybeSingle();
  if (productError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/finance/inquiries", operation: "check_product", error: productError }); return NextResponse.json({ error: "Chưa xác định được sản phẩm còn nhận yêu cầu.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  const provider = Array.isArray(product?.finance_providers) ? product.finance_providers[0] : product?.finance_providers;
  if (!product || product.status !== "approved" || !provider?.is_verified) return NextResponse.json({ error: "Sản phẩm không còn nhận yêu cầu tư vấn." }, { status: 404 });
  if (!TOPICS[product.category]?.includes(input.topic)) return NextResponse.json({ error: "Chủ đề tư vấn không phù hợp với nhóm sản phẩm." }, { status: 400 });
  const consentText = `Tôi đồng ý để ${provider.provider_name} nhận họ tên, số điện thoại, tỉnh/thành liên hệ, ${product.category === "remittance" ? "tỉnh/thành nhận tiền (nếu có), " : ""}email (nếu có), chủ đề và lời nhắn nhằm liên hệ tư vấn về ${product.title}. Đây chưa phải hồ sơ vay hay lệnh giao dịch.`;
  const { data, error } = await supabase.from("finance_inquiries").insert({ product_id: product.id, provider_id: product.provider_id, category: product.category, inquiry_topic: input.topic, full_name: input.fullName, phone: input.phone, email: input.email || null, province_code: input.provinceCode || null, destination_province_code: product.category === "remittance" ? input.destinationProvinceCode || null : null, message: input.message || null, contact_consent: true, consent_text: consentText, consented_at: new Date().toISOString() }).select("id,status,created_at").single();
  if (error || !data) { const requestId = error ? logSafeSupabaseError({ route: "/api/mobile/finance/inquiries", operation: "create_inquiry", error }) : undefined; return NextResponse.json({ error: "Chưa gửi được yêu cầu tư vấn.", ...(requestId ? { requestId } : {}) }, { status: 503, headers: requestId ? { "X-Request-Id": requestId } : {} }); }
  return NextResponse.json({ ok: true, inquiry: data }, { status: 201 });
}
