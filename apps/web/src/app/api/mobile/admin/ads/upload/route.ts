import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { AD_IMAGE_MAX_BYTES, adImageSizeError, readImageSize } from "@/lib/ad-image";
import { AD_PLACEMENTS, type AdPlacement } from "@/lib/ads";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

const headers = { "Cache-Control": "private, no-store" };
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

// Tải ảnh quảng cáo lên từ app Admin (cùng nơi lưu ảnh với trang quản trị web). Form gồm file và placement; ảnh phải đúng tỉ lệ và độ rộng
// của khung ở vị trí đó (xem lib/ad-image.ts). Trả về liên kết https của ảnh.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) { auth.error.headers.set("Cache-Control", headers["Cache-Control"]); return auth.error; }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) return NextResponse.json({ error: "Vui lòng chọn ảnh." }, { status: 400, headers });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "Chỉ hỗ trợ ảnh PNG, JPG hoặc WEBP." }, { status: 400, headers });
  const placement = String(form?.get("placement") ?? "");
  if (!(AD_PLACEMENTS as readonly string[]).includes(placement)) return NextResponse.json({ error: "Chọn vị trí quảng cáo trước khi tải ảnh." }, { status: 400, headers });
  if (file.size > AD_IMAGE_MAX_BYTES) return NextResponse.json({ error: "Ảnh tối đa 5MB." }, { status: 400, headers });
  const size = readImageSize(new Uint8Array(await file.arrayBuffer()));
  if (!size) return NextResponse.json({ error: "Không đọc được kích thước ảnh. Hãy chọn ảnh PNG, JPG hoặc WEBP khác." }, { status: 400, headers });
  const sizeError = adImageSizeError(placement as AdPlacement, size.width, size.height);
  if (sizeError) return NextResponse.json({ error: sizeError }, { status: 400, headers });
  try {
    const url = await uploadImageToCloudinary(file, "ads");
    return NextResponse.json({ ok: true, url }, { headers });
  } catch {
    return NextResponse.json({ error: "Tải ảnh lên thất bại. Vui lòng thử lại." }, { status: 503, headers });
  }
}
