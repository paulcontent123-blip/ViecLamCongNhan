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

  let oldLogoDeleted = false;
  let newLogoUrl: string | null = null;

  try {
    // Xóa asset cũ trước khi upload và lưu URL logo mới theo yêu cầu.
    if (employer.company_logo_url) {
      oldLogoDeleted = await deleteImageFromCloudinary(employer.company_logo_url);
    }

    newLogoUrl = await uploadImageToCloudinary(file, "company-logos");
    const { error: updateError } = await supabase
      .from("employers")
      .update({ company_logo_url: newLogoUrl })
      .eq("id", session.employerId);

    if (updateError) throw new Error("Không lưu được logo mới vào hồ sơ công ty.");
    return NextResponse.json({ url: newLogoUrl });
  } catch (err) {
    if (newLogoUrl) {
      await deleteImageFromCloudinary(newLogoUrl).catch(() => undefined);
    }
    if (oldLogoDeleted) {
      // Không để hồ sơ tiếp tục trỏ tới asset cũ đã bị xóa nếu upload/lưu mới thất bại.
      await supabase.from("employers").update({ company_logo_url: null }).eq("id", session.employerId);
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tải ảnh lên thất bại." },
      { status: 500 },
    );
  }
}
