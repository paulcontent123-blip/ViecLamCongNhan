import { NextRequest, NextResponse } from "next/server";
import { getEmployerSession } from "@/lib/employer-auth";
import { isEmployerVerified } from "@/lib/employer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteImageFromCloudinary, uploadImageToCloudinary } from "@/lib/cloudinary";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function POST(request: NextRequest) {
  const session = await getEmployerSession();
  if (!session) {
    return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  }

  if (!(await isEmployerVerified(session.employerId))) {
    return NextResponse.json(
      { error: "Tài khoản đang chờ Admin xác minh, chưa thể cập nhật logo." },
      { status: 403 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Vui lòng chọn ảnh." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Chỉ hỗ trợ ảnh PNG, JPG, WEBP hoặc SVG." }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Ảnh tối đa 5MB." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: employer, error: employerError } = await supabase
    .from("employers")
    .select("company_logo_url")
    .eq("id", session.employerId)
    .maybeSingle();

  if (employerError || !employer) {
    return NextResponse.json({ error: "Không tải được logo hiện tại của công ty." }, { status: 500 });
  }

  let newLogoUrl: string;
  try {
    // Keep the current logo intact until the replacement is uploaded and saved.
    newLogoUrl = await uploadImageToCloudinary(file, "company-logos");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tải ảnh lên thất bại." },
      { status: 500 },
    );
  }

  let update = supabase
    .from("employers")
    .update({ company_logo_url: newLogoUrl })
    .eq("id", session.employerId);
  update = employer.company_logo_url
    ? update.eq("company_logo_url", employer.company_logo_url)
    : update.is("company_logo_url", null);

  const { data: saved, error: updateError } = await update
    .select("company_logo_url")
    .maybeSingle();

  if (updateError || !saved) {
    // A failed HTTP response can be ambiguous: verify the DB before cleaning up
    // the staged asset, otherwise a committed replacement could become a broken URL.
    const { data: current, error: readError } = await supabase
      .from("employers")
      .select("company_logo_url")
      .eq("id", session.employerId)
      .maybeSingle();

    if (!readError && current?.company_logo_url === newLogoUrl) {
      if (employer.company_logo_url && employer.company_logo_url !== newLogoUrl) {
        await deleteImageFromCloudinary(employer.company_logo_url).catch(() => false);
      }
      return NextResponse.json({ url: newLogoUrl });
    }

    if (!readError && current?.company_logo_url === employer.company_logo_url) {
      await deleteImageFromCloudinary(newLogoUrl).catch(() => false);
      return NextResponse.json(
        { error: "Không lưu được logo mới. Logo hiện tại vẫn được giữ nguyên." },
        { status: updateError ? 500 : 409 },
      );
    }

    return NextResponse.json(
      { error: "Chưa xác định được logo đã lưu hay chưa. Tải lại hồ sơ trước khi thử lại." },
      { status: 503 },
    );
  }

  if (employer.company_logo_url && employer.company_logo_url !== newLogoUrl) {
    // Cleanup is best effort and happens only after the DB points at the new asset.
    await deleteImageFromCloudinary(employer.company_logo_url).catch(() => false);
  }

  return NextResponse.json({ url: newLogoUrl });
}
