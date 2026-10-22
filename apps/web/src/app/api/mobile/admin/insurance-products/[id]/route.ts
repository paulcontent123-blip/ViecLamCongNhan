import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isInsuranceProviderUnverifiedError, logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
const schema = z.object({ status: z.enum(["approved", "rejected", "hidden"]), rejectionReason: z.string().trim().max(1000).optional() }).refine(value => value.status !== "rejected" || (value.rejectionReason || "").trim().length >= 3);
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { id } = await context.params; if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã sản phẩm không hợp lệ." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Trạng thái kiểm duyệt không hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: product, error: lookupError } = await supabase.from("insurance_products").select("id,provider_id").eq("id", id).maybeSingle();
  if (lookupError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/insurance-products/[id]", operation: "check_product", error: lookupError }); return NextResponse.json({ error: "Chưa xác minh được quyền kiểm duyệt sản phẩm.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  if (!product) return NextResponse.json({ error: "Không tìm thấy sản phẩm." }, { status: 404 });
  if (parsed.data.status === "approved") {
    const { data: provider, error: providerError } = await supabase.from("insurance_providers").select("is_verified").eq("id", product.provider_id).maybeSingle();
    if (providerError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/insurance-products/[id]", operation: "check_provider_verification", error: providerError }); return NextResponse.json({ error: "Chưa xác minh được trạng thái đối tác.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
    if (!provider?.is_verified) return NextResponse.json({ error: "Không thể duyệt sản phẩm khi đối tác chưa được xác minh." }, { status: 403 });
  }
  const { data, error } = await supabase.from("insurance_products").update({ status: parsed.data.status, rejection_reason: parsed.data.status === "rejected" ? parsed.data.rejectionReason?.trim() : null, published_at: parsed.data.status === "approved" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id).select("id,status,rejection_reason,published_at").maybeSingle();
  if (error) { if (isInsuranceProviderUnverifiedError(error)) return NextResponse.json({ error: "Không thể duyệt sản phẩm khi đối tác chưa được xác minh." }, { status: 403 }); const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/insurance-products/[id]", operation: "review_product", error }); return NextResponse.json({ error: "Chưa cập nhật được trạng thái kiểm duyệt.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  if (!data) return NextResponse.json({ error: "Không tìm thấy sản phẩm." }, { status: 404 });
  return NextResponse.json({ ok: true, product: data }, { headers: { "Cache-Control": "private, no-store" } });
}
