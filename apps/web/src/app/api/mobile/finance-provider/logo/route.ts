import { NextRequest, NextResponse } from "next/server";
import { getFinanceProviderSession } from "@/lib/finance-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { deleteImageFromCloudinary, uploadImageToCloudinary } from "@/lib/cloudinary";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: NextRequest) {
  const session = await getFinanceProviderSession(); if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const supabase = createSupabaseAdminClient();
  const { data: provider, error: readError } = await supabase.from("finance_providers").select("logo_url").eq("id", session.providerId).maybeSingle();
  if (readError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/finance-provider/logo", operation: "load_current_logo", error: readError }); return NextResponse.json({ error: "Chưa tải được logo hiện tại.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } }); }
  if (!provider) return NextResponse.json({ error: "Không tìm thấy hồ sơ đối tác." }, { status: 404, headers });
  const form = await request.formData().catch(() => null); const file = form?.get("file");
  if (!file || !(file instanceof File)) return NextResponse.json({ error: "Vui lòng chọn ảnh." }, { status: 400, headers });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "Chỉ hỗ trợ ảnh PNG, JPG, WEBP hoặc SVG." }, { status: 400, headers });
  if (file.size <= 0 || file.size > MAX_SIZE) return NextResponse.json({ error: "Ảnh phải lớn hơn 0 byte và tối đa 5MB." }, { status: 400, headers });
  let newUrl: string;
  try { newUrl = await uploadImageToCloudinary(file, "finance-provider-logos"); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tải logo lên thất bại." }, { status: 500, headers }); }
  let update = supabase.from("finance_providers").update({ logo_url: newUrl, updated_at: new Date().toISOString() }).eq("id", session.providerId);
  update = provider.logo_url ? update.eq("logo_url", provider.logo_url) : update.is("logo_url", null);
  const { data: saved, error: updateError } = await update.select("logo_url").maybeSingle();
  if (updateError || !saved) {
    const updateRequestId = updateError ? logSafeSupabaseError({ route: "/api/mobile/finance-provider/logo", operation: "save_logo_url", error: updateError }) : undefined;
    const { data: current, error: readBackError } = await supabase.from("finance_providers").select("logo_url").eq("id", session.providerId).maybeSingle();
    const readRequestId = readBackError ? logSafeSupabaseError({ route: "/api/mobile/finance-provider/logo", operation: "read_logo_after_update", error: readBackError }) : undefined;
    if (!readBackError && current?.logo_url === newUrl) {
      if (provider.logo_url && provider.logo_url !== newUrl) await deleteImageFromCloudinary(provider.logo_url).catch(() => false);
      return NextResponse.json({ ok: true, url: newUrl }, { headers });
    }
    if (!readBackError && current && current.logo_url === provider.logo_url) {
      await deleteImageFromCloudinary(newUrl).catch(() => false);
      return NextResponse.json({ error: "Không lưu được logo mới. Logo hiện tại vẫn được giữ nguyên.", ...(updateRequestId ? { requestId: updateRequestId } : {}) }, { status: updateError ? 500 : 409, headers: updateRequestId ? { ...headers, "X-Request-Id": updateRequestId } : headers });
    }
    const requestId = readRequestId ?? updateRequestId;
    return NextResponse.json({ error: "Chưa xác định được logo đã lưu hay chưa. Tải lại hồ sơ trước khi thử lại.", ...(requestId ? { requestId } : {}) }, { status: 503, headers: requestId ? { ...headers, "X-Request-Id": requestId } : headers });
  }
  if (provider.logo_url && provider.logo_url !== newUrl) await deleteImageFromCloudinary(provider.logo_url).catch(() => false);
  return NextResponse.json({ ok: true, url: newUrl }, { headers });
}
