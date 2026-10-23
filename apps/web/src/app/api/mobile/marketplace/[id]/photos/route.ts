import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteImageFromCloudinary, isCloudinaryImageInFolder, uploadImageToCloudinary } from "@/lib/cloudinary";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const MAX_SIZE = 5 * 1024 * 1024;
const MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
function matchesImageSignature(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}
async function loadOwnedListing(id: string, userId: string) {
  return createSupabaseAdminClient().from("secondhand_marketplace_listings")
    .select("id,photo_urls,expires_at").eq("id", id).eq("seller_user_id", userId).maybeSingle();
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Mã tin không hợp lệ." }, { status: 400 });
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { data: listing, error: loadError } = await loadOwnedListing(id, session.userId);
  if (loadError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/[id]/photos", operation: "load_listing_before_photo_upload", error: loadError });
    return NextResponse.json({ error: "Chưa xác minh được tin để tải ảnh.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!listing) return NextResponse.json({ error: "Không tìm thấy tin của bạn." }, { status: 404 });
  if (listing.expires_at && new Date(listing.expires_at) <= new Date()) return NextResponse.json({ error: "Tin đã hết hiệu lực sau 30 ngày." }, { status: 409 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_SIZE || !MIME_TYPES.includes(file.type)) return NextResponse.json({ error: "Chọn ảnh JPG, PNG hoặc WEBP tối đa 5MB." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesImageSignature(bytes, file.type)) return NextResponse.json({ error: "Định dạng ảnh không khớp nội dung tệp." }, { status: 400 });
  const folder = `secondhand-marketplace/${session.userId}/${id}`;
  let photoUrl: string;
  try { photoUrl = await uploadImageToCloudinary(file, folder); }
  catch { return NextResponse.json({ error: "Tải ảnh lên chưa thành công. Kiểm tra lại danh sách ảnh trước khi thử tiếp." }, { status: 503 }); }
  if (!isCloudinaryImageInFolder(photoUrl, folder)) {
    await deleteImageFromCloudinary(photoUrl).catch(() => false);
    return NextResponse.json({ error: "Ảnh tải lên không thuộc tin này." }, { status: 503 });
  }
  const { data, error } = await createSupabaseAdminClient().rpc("append_secondhand_marketplace_photo", { p_listing_id: id, p_seller_user_id: session.userId, p_photo_url: photoUrl });
  if (error) {
    if (error.message.includes("PHOTO_LIMIT")) {
      await deleteImageFromCloudinary(photoUrl).catch(() => false);
      return NextResponse.json({ error: "Mỗi tin đăng tối đa 8 ảnh." }, { status: 409 });
    }
    if (error.message.includes("LISTING_EXPIRED")) {
      await deleteImageFromCloudinary(photoUrl).catch(() => false);
      return NextResponse.json({ error: "Tin đã hết hiệu lực sau 30 ngày." }, { status: 409 });
    }
    const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/[id]/photos", operation: "save_marketplace_photo", error });
    return NextResponse.json({ error: "Ảnh đã tải lên nhưng chưa xác nhận được danh sách ảnh. Tải lại tin để kiểm tra trước khi thử tiếp.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, photoUrls: data || [] });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Mã tin không hợp lệ." }, { status: 400 });
  const session = await getCandidateSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const schema = z.object({ expectedPhotoUrls: z.array(z.string().url()).max(8), photoUrls: z.array(z.string().url()).max(8) });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Danh sách ảnh không hợp lệ." }, { status: 400 });
  const folder = `secondhand-marketplace/${session.userId}/${id}`;
  if (parsed.data.expectedPhotoUrls.some(url => !isCloudinaryImageInFolder(url, folder)) || parsed.data.photoUrls.some(url => !isCloudinaryImageInFolder(url, folder))) return NextResponse.json({ error: "Ảnh không thuộc tin này." }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().rpc("set_secondhand_marketplace_photos", { p_listing_id: id, p_seller_user_id: session.userId, p_expected_photo_urls: parsed.data.expectedPhotoUrls, p_next_photo_urls: parsed.data.photoUrls });
  if (error) {
    if (error.message.includes("PHOTOS_CONFLICT")) return NextResponse.json({ error: "Danh sách ảnh vừa thay đổi ở nơi khác. Tải lại trước khi sửa." }, { status: 409 });
    if (error.message.includes("LISTING_EXPIRED")) return NextResponse.json({ error: "Tin đã hết hiệu lực sau 30 ngày." }, { status: 409 });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/marketplace/[id]/photos", operation: "update_marketplace_photos", error });
    return NextResponse.json({ error: "Chưa cập nhật được ảnh. Tải lại tin để kiểm tra.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const removed = parsed.data.expectedPhotoUrls.filter(url => !parsed.data.photoUrls.includes(url));
  await Promise.allSettled(removed.map(url => deleteImageFromCloudinary(url)));
  return NextResponse.json({ ok: true, photoUrls: data || [] });
}
