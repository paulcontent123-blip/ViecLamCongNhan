import { NextRequest, NextResponse } from "next/server";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { deleteImageFromCloudinary, uploadImageToCloudinary } from "@/lib/cloudinary";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  const session = await getTrainingProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

  const supabase = createSupabaseAdminClient();
  const { data: provider, error: providerError } = await supabase
    .from("training_providers")
    .select("logo_url")
    .eq("id", session.providerId)
    .maybeSingle();
  if (providerError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/training-provider/logo", operation: "load_current_logo", error: providerError });
    return NextResponse.json({ error: "Chưa tải được logo hiện tại của đơn vị.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  if (!provider) {
    return NextResponse.json({ error: "Không tải được logo hiện tại của đơn vị." }, { status: 500, headers });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Vui lòng chọn ảnh." }, { status: 400, headers });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Chỉ hỗ trợ ảnh PNG, JPG, WEBP hoặc SVG." }, { status: 400, headers });
  }
  if (file.size <= 0 || file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Ảnh phải lớn hơn 0 byte và tối đa 5MB." }, { status: 400, headers });
  }

  let newLogoUrl: string;
  try {
    newLogoUrl = await uploadImageToCloudinary(file, "training-provider-logos");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tải ảnh lên thất bại." },
      { status: 500, headers },
    );
  }

  let update = supabase
    .from("training_providers")
    .update({ logo_url: newLogoUrl, updated_at: new Date().toISOString() })
    .eq("id", session.providerId);
  update = provider.logo_url
    ? update.eq("logo_url", provider.logo_url)
    : update.is("logo_url", null);

  const { data: saved, error: updateError } = await update.select("logo_url").maybeSingle();
  if (updateError || !saved) {
    const updateRequestId = updateError
      ? logSafeSupabaseError({ route: "/api/mobile/training-provider/logo", operation: "save_logo_url", error: updateError })
      : undefined;
    const { data: current, error: readError } = await supabase
      .from("training_providers")
      .select("logo_url")
      .eq("id", session.providerId)
      .maybeSingle();
    const readRequestId = readError
      ? logSafeSupabaseError({ route: "/api/mobile/training-provider/logo", operation: "read_logo_after_update", error: readError })
      : undefined;

    if (!readError && current?.logo_url === newLogoUrl) {
      if (provider.logo_url && provider.logo_url !== newLogoUrl) {
        await deleteImageFromCloudinary(provider.logo_url).catch(() => false);
      }
      return NextResponse.json({ ok: true, url: newLogoUrl }, { headers });
    }

    if (!readError && current && current.logo_url === provider.logo_url) {
      await deleteImageFromCloudinary(newLogoUrl).catch(() => false);
      return NextResponse.json(
        { error: "Không lưu được logo mới. Logo hiện tại vẫn được giữ nguyên.", ...(updateRequestId ? { requestId: updateRequestId } : {}) },
        { status: updateError ? 500 : 409, headers: updateRequestId ? { ...headers, "X-Request-Id": updateRequestId } : headers },
      );
    }

    const requestId = readRequestId ?? updateRequestId;
    return NextResponse.json(
      { error: "Chưa xác định được logo đã lưu hay chưa. Tải lại hồ sơ trước khi thử lại.", ...(requestId ? { requestId } : {}) },
      { status: 503, headers: requestId ? { ...headers, "X-Request-Id": requestId } : headers },
    );
  }

  if (provider.logo_url && provider.logo_url !== newLogoUrl) {
    await deleteImageFromCloudinary(provider.logo_url).catch(() => false);
  }
  return NextResponse.json({ ok: true, url: newLogoUrl }, { headers });
}
