import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({ productId: z.string().uuid(), fullName: z.string().trim().min(2).max(120), phone: z.string().trim().min(9).max(20), email: z.string().trim().email().max(254).optional().or(z.literal("")), message: z.string().trim().max(2000).optional(), contactConsent: z.literal(true) });
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin yêu cầu không hợp lệ." }, { status: 400 });
  const input = parsed.data; const supabase = createSupabaseAdminClient();
  const { data: product, error: productError } = await supabase.from("insurance_products").select("id,provider_id,status,insurance_providers!inner(is_verified)").eq("id", input.productId).maybeSingle();
  if (productError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/insurance/inquiries", operation: "check_product", error: productError }); return NextResponse.json({ error: "Chưa xác định được sản phẩm còn nhận yêu cầu.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  const provider = Array.isArray(product?.insurance_providers) ? product.insurance_providers[0] : product?.insurance_providers;
  if (!product || product.status !== "approved" || !provider?.is_verified) return NextResponse.json({ error: "Sản phẩm không còn nhận yêu cầu tư vấn." }, { status: 404 });
  const { data, error } = await supabase.from("insurance_inquiries").insert({ product_id: product.id, provider_id: product.provider_id, full_name: input.fullName, phone: input.phone, email: input.email || null, message: input.message || null, contact_consent: true }).select("id,status,created_at").single();
  if (error || !data) { const requestId = error ? logSafeSupabaseError({ route: "/api/mobile/insurance/inquiries", operation: "create_inquiry", error }) : undefined; return NextResponse.json({ error: "Chưa gửi được yêu cầu tư vấn.", ...(requestId ? { requestId } : {}) }, { status: 503, headers: requestId ? { "X-Request-Id": requestId } : {} }); }
  return NextResponse.json({ ok: true, inquiry: data }, { status: 201 });
}
