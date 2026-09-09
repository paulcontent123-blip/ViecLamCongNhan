import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const ALLOWED_FOLDERS = new Set(["article-content", "article-covers"]);

/** Upload ảnh cho trình soạn bài viết ở trang Quản trị (ảnh trong bài + ảnh đại diện). */
export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const folderInput = String(form?.get("folder") ?? "article-content");
  const folder = ALLOWED_FOLDERS.has(folderInput) ? folderInput : "article-content";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Vui lòng chọn ảnh." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Chỉ hỗ trợ ảnh PNG, JPG, WEBP hoặc GIF." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Ảnh tối đa 5MB." }, { status: 400 });
  }

  try {
    const url = await uploadImageToCloudinary(file, folder);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tải ảnh lên thất bại." },
      { status: 500 },
    );
  }
}
