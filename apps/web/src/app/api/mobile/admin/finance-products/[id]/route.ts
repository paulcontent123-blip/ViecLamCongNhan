import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isFinanceProviderUnverifiedError, logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
const schema = z.object({ status: z.enum(["approved", "rejected", "hidden"]), rejectionReason: z.string().trim().max(1000).optional(), pricingApproved: z.boolean().optional(), expectedUpdatedAt: z.string().trim().min(1).max(64) }).refine(value => value.status !== "rejected" || (value.rejectionReason || "").trim().length >= 3);
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession(); if (!admin) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { id } = await context.params; if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã sản phẩm không hợp lệ." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Trạng thái kiểm duyệt không hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: product, error: lookupError } = await supabase.from("finance_products").select("id,provider_id,status,updated_at,archived_at,price_label,pricing_source_url,pricing_effective_at").eq("id", id).maybeSingle();
  if (lookupError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/finance-products/[id]", operation: "check_product", error: lookupError }); return NextResponse.json({ error: "Chưa xác minh được quyền kiểm duyệt sản phẩm.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  if (!product) return NextResponse.json({ error: "Không tìm thấy sản phẩm." }, { status: 404 });
  if (product.archived_at) return NextResponse.json({ error: "Sản phẩm đã được đối tác lưu trữ và không còn được kiểm duyệt." }, { status: 409 });
  if (product.updated_at !== parsed.data.expectedUpdatedAt) return NextResponse.json({ error: "Nội dung sản phẩm đã thay đổi. Tải lại danh sách để kiểm tra phiên bản mới." }, { status: 409 });
  if (["approved", "rejected"].includes(parsed.data.status) && product.status !== "pending") return NextResponse.json({ error: "Sản phẩm không còn ở trạng thái chờ duyệt. Tải lại danh sách." }, { status: 409 });
  if (parsed.data.status === "hidden" && product.status !== "approved") return NextResponse.json({ error: "Chỉ có thể ẩn sản phẩm đang được duyệt công khai." }, { status: 409 });
  if (parsed.data.status === "approved" || parsed.data.pricingApproved === true) {
    const { data: provider, error: providerError } = await supabase.from("finance_providers").select("is_verified,license_number,license_evidence_url").eq("id", product.provider_id).maybeSingle();
    if (providerError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/finance-products/[id]", operation: "check_provider_verification", error: providerError }); return NextResponse.json({ error: "Chưa xác minh được trạng thái đối tác.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
    if (parsed.data.status === "approved" && !provider?.is_verified) return NextResponse.json({ error: "Không thể duyệt sản phẩm khi đối tác chưa được xác minh." }, { status: 403 });
    if (parsed.data.status === "approved" && parsed.data.pricingApproved !== true) return NextResponse.json({ error: "Cần xác nhận đã kiểm tra giấy phép và căn cứ phí/lãi trước khi công khai sản phẩm tài chính." }, { status: 400 });
    if (parsed.data.status === "approved" || parsed.data.pricingApproved === true) {
      if (!provider?.license_number?.trim()) return NextResponse.json({ error: "Đơn vị chưa khai báo số giấy phép / ủy quyền." }, { status: 400 });
      if (!provider.license_evidence_url?.trim()) return NextResponse.json({ error: "Đơn vị chưa tải hồ sơ giấy phép hoặc cung cấp liên kết hồ sơ." }, { status: 400 });
      if (!product.price_label?.trim()) return NextResponse.json({ error: "Sản phẩm chưa khai báo thông tin phí/lãi." }, { status: 400 });
      if (!product.pricing_source_url?.trim()) return NextResponse.json({ error: "Sản phẩm chưa có liên kết căn cứ phí/lãi." }, { status: 400 });
      if (!product.pricing_effective_at) return NextResponse.json({ error: "Sản phẩm chưa có ngày hiệu lực của căn cứ phí/lãi." }, { status: 400 });
    }
  }
  const pricePatch = parsed.data.pricingApproved === undefined ? {} : { pricing_approved: parsed.data.pricingApproved, pricing_reviewed_at: parsed.data.pricingApproved ? new Date().toISOString() : null, pricing_reviewed_by: parsed.data.pricingApproved ? admin.userId : null };
  const { data, error } = await supabase.from("finance_products").update({ ...pricePatch, status: parsed.data.status, rejection_reason: parsed.data.status === "rejected" ? parsed.data.rejectionReason?.trim() : null, published_at: parsed.data.status === "approved" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id).eq("updated_at", product.updated_at).eq("status", product.status).is("archived_at", null).select("id,status,rejection_reason,published_at,pricing_approved,pricing_reviewed_at,updated_at").maybeSingle();
  if (error) { if (isFinanceProviderUnverifiedError(error)) return NextResponse.json({ error: "Không thể duyệt sản phẩm khi đối tác chưa được xác minh." }, { status: 403 }); const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/finance-products/[id]", operation: "review_product", error }); return NextResponse.json({ error: "Chưa cập nhật được trạng thái kiểm duyệt.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
  if (!data) return NextResponse.json({ error: "Sản phẩm vừa được cập nhật bởi người khác. Tải lại danh sách trước khi duyệt tiếp." }, { status: 409 });
  return NextResponse.json({ ok: true, product: data }, { headers: { "Cache-Control": "private, no-store" } });
}
