import { NextRequest, NextResponse } from "next/server";
import { getHealthProviderSession } from "@/lib/health-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteImageFromCloudinary, uploadImageToCloudinary } from "@/lib/cloudinary";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
const MAX_SIZE = 5 * 1024 * 1024; const TYPES = ["image/png", "image/jpeg", "image/webp"];
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: NextRequest) {
  const session = await getHealthProviderSession(); if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const supabase = createSupabaseAdminClient(); const { data: current, error: readError } = await supabase.from("health_providers").select("logo_url").eq("id", session.providerId).maybeSingle();
  if (readError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/health-provider/logo", operation: "load_current_logo", error: readError }); return NextResponse.json({ error: "Chưa tải được hồ sơ logo.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } }); }
  if (!current) return NextResponse.json({ error: "Không tìm thấy hồ sơ cơ sở y tế." }, { status: 404, headers });
  const form = await request.formData().catch(() => null); const file = form?.get("file");
  if (!file || !(file instanceof File)) return NextResponse.json({ error: "Vui lòng chọn ảnh logo." }, { status: 400, headers });
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: "Chỉ hỗ trợ ảnh PNG, JPG hoặc WEBP." }, { status: 400, headers });
  if (file.size <= 0 || file.size > MAX_SIZE) return NextResponse.json({ error: "Ảnh phải lớn hơn 0 byte và tối đa 5MB." }, { status: 400, headers });
  let url: string; try { url = await uploadImageToCloudinary(file, "health-provider-logos"); } catch { return NextResponse.json({ error: "Tải logo lên chưa thành công." }, { status: 503, headers }); }
  let update = supabase.from("health_providers").update({ logo_url: url, updated_at: new Date().toISOString() }).eq("id", session.providerId);
  update = current.logo_url ? update.eq("logo_url", current.logo_url) : update.is("logo_url", null);
  const { data: saved, error: updateError } = await update.select("logo_url").maybeSingle();
  if (!saved || updateError) {
    const updateId = updateError ? logSafeSupabaseError({ route: "/api/mobile/health-provider/logo", operation: "save_logo_url", error: updateError }) : undefined;
    const { data: latest, error: readBackError } = await supabase.from("health_providers").select("logo_url").eq("id", session.providerId).maybeSingle();
    if (!readBackError && latest?.logo_url === url) { if (current.logo_url && current.logo_url !== url) await deleteImageFromCloudinary(current.logo_url).catch(() => false); return NextResponse.json({ ok: true, url }, { headers }); }
    if (!readBackError && latest?.logo_url === current.logo_url) { await deleteImageFromCloudinary(url).catch(() => false); return NextResponse.json({ error: "Logo mới chưa được lưu; logo hiện tại vẫn được giữ nguyên." }, { status: 409, headers }); }
    const readId = readBackError ? logSafeSupabaseError({ route: "/api/mobile/health-provider/logo", operation: "verify_logo_url", error: readBackError }) : undefined;
    const requestId = readId || updateId || crypto.randomUUID();
    return NextResponse.json({ error: "Chưa xác định được logo đã lưu hay chưa. Tải lại hồ sơ trước khi thử lại.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  if (current.logo_url && current.logo_url !== url) await deleteImageFromCloudinary(current.logo_url).catch(() => false);
  return NextResponse.json({ ok: true, url }, { headers });
}
