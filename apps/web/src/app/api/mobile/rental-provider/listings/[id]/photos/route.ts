import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRentalProviderSession } from "@/lib/rental-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteImageFromCloudinary, isCloudinaryImageInFolder, uploadImageToCloudinary } from "@/lib/cloudinary";
import { isRentalProviderUnverifiedError } from "@/lib/rental-provider-listing-utils";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const MAX_PHOTOS = 12;
// Keep each multipart request below Vercel Functions' 4.5 MB total body cap,
// leaving room for multipart boundaries and headers.
const MAX_PHOTO_SIZE = 4 * 1024 * 1024;
const headers = { "Cache-Control": "private, no-store" };
const updatePhotosSchema = z.object({
  expectedPhotoUrls: z.array(z.string().url().startsWith("https://")).max(MAX_PHOTOS),
  photoUrls: z.array(z.string().url().startsWith("https://")).max(MAX_PHOTOS),
});

function matchesImageSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

async function loadListingPhotos(listingId: string, providerId: string) {
  return createSupabaseAdminClient().from("rental_listings")
    .select("id,status,photo_urls")
    .eq("id", listingId)
    .eq("provider_id", providerId)
    .maybeSingle();
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getRentalProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Mã tin cho thuê không hợp lệ." }, { status: 400, headers });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Vui lòng chọn ảnh." }, { status: 400, headers });
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return NextResponse.json({ error: "Ảnh tin cho thuê hỗ trợ JPG, PNG hoặc WEBP." }, { status: 400, headers });
  }
  if (file.size <= 0 || file.size > MAX_PHOTO_SIZE) {
    return NextResponse.json({ error: "Mỗi ảnh phải lớn hơn 0 byte và tối đa 4MB." }, { status: 400, headers });
  }
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!matchesImageSignature(file.type, signature)) {
    return NextResponse.json({ error: "Nội dung tệp không khớp với định dạng ảnh." }, { status: 400, headers });
  }

  const supabase = createSupabaseAdminClient();
  const { data: listing, error: loadError } = await loadListingPhotos(id, session.providerId);
  if (loadError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/listings/[id]/photos", operation: "load_listing_before_photo_upload", error: loadError });
    return NextResponse.json({ error: "Chưa tải được tin cho thuê.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  if (!listing) return NextResponse.json({ error: "Không tìm thấy tin thuộc tài khoản này." }, { status: 404, headers });
  const existingUrls = listing.photo_urls || [];
  if (existingUrls.length >= MAX_PHOTOS) return NextResponse.json({ error: `Mỗi tin cho thuê được đăng tối đa ${MAX_PHOTOS} ảnh.` }, { status: 409, headers });

  const folder = `rental-listing-photos/${session.providerId}/${id}`;
  let photoUrl: string;
  try {
    photoUrl = await uploadImageToCloudinary(file, folder);
  } catch {
    return NextResponse.json({ error: "Chưa tải được ảnh lên kho lưu trữ. Kiểm tra mạng và thử lại." }, { status: 502, headers });
  }
  if (!isCloudinaryImageInFolder(photoUrl, folder)) {
    await deleteImageFromCloudinary(photoUrl).catch(() => false);
    return NextResponse.json({ error: "Kho lưu trữ trả về đường dẫn ảnh không hợp lệ." }, { status: 502, headers });
  }

  const { error: appendError } = await supabase.rpc("append_rental_listing_photo", {
    p_listing_id: id,
    p_provider_id: session.providerId,
    p_photo_url: photoUrl,
  });
  const { data: saved, error: readError } = await loadListingPhotos(id, session.providerId);
  if (readError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/listings/[id]/photos", operation: "read_listing_after_photo_upload", error: readError });
    if (appendError) logSafeSupabaseError({ route: "/api/mobile/rental-provider/listings/[id]/photos", operation: "append_listing_photo", error: appendError });
    return NextResponse.json({ error: "Chưa xác định được ảnh đã gắn vào tin hay chưa. Tải lại tin trước khi thử tiếp.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  if (saved?.photo_urls?.includes(photoUrl)) {
    return NextResponse.json({ ok: true, photoUrls: saved.photo_urls, status: saved.status }, { headers });
  }

  if (appendError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/listings/[id]/photos", operation: "append_listing_photo", error: appendError });
    await deleteImageFromCloudinary(photoUrl).catch(() => false);
    if (isRentalProviderUnverifiedError(appendError)) {
      return NextResponse.json({ error: "Đối tác cần được Admin xác minh trước khi cập nhật ảnh tin cho thuê." }, { status: 403, headers });
    }
    if (appendError.message?.includes("RENTAL_LISTING_PHOTO_LIMIT")) {
      return NextResponse.json({ error: `Mỗi tin cho thuê được đăng tối đa ${MAX_PHOTOS} ảnh.` }, { status: 409, headers });
    }
    if (appendError.message?.includes("RENTAL_LISTING_NOT_FOUND")) {
      return NextResponse.json({ error: "Không tìm thấy tin thuộc tài khoản này." }, { status: 404, headers });
    }
    return NextResponse.json({ error: "Chưa lưu được ảnh cho tin cho thuê.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }

  await deleteImageFromCloudinary(photoUrl).catch(() => false);
  return NextResponse.json({ error: "Chưa xác nhận được ảnh đã lưu. Tải lại tin trước khi thử tiếp." }, { status: 503, headers });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getRentalProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Mã tin cho thuê không hợp lệ." }, { status: 400, headers });
  const parsed = updatePhotosSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Danh sách ảnh không hợp lệ." }, { status: 400, headers });
  const { expectedPhotoUrls, photoUrls } = parsed.data;
  if (new Set(photoUrls).size !== photoUrls.length) return NextResponse.json({ error: "Danh sách ảnh không được trùng." }, { status: 400, headers });

  const supabase = createSupabaseAdminClient();
  const { data: before, error: loadError } = await loadListingPhotos(id, session.providerId);
  if (loadError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/listings/[id]/photos", operation: "load_listing_before_photo_update", error: loadError });
    return NextResponse.json({ error: "Chưa tải được tin cho thuê.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  if (!before) return NextResponse.json({ error: "Không tìm thấy tin thuộc tài khoản này." }, { status: 404, headers });

  const { error: updateError } = await supabase.rpc("set_rental_listing_photos", {
    p_listing_id: id,
    p_provider_id: session.providerId,
    p_expected_photo_urls: expectedPhotoUrls,
    p_next_photo_urls: photoUrls,
  });
  const { data: saved, error: readError } = await loadListingPhotos(id, session.providerId);
  if (readError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/listings/[id]/photos", operation: "read_listing_after_photo_update", error: readError });
    if (updateError) logSafeSupabaseError({ route: "/api/mobile/rental-provider/listings/[id]/photos", operation: "set_listing_photos", error: updateError });
    return NextResponse.json({ error: "Chưa xác định được danh sách ảnh đã lưu hay chưa. Tải lại tin trước khi thử tiếp.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  if (saved && JSON.stringify(saved.photo_urls || []) === JSON.stringify(photoUrls)) {
    const folder = `rental-listing-photos/${session.providerId}/${id}`;
    const removedUrls = (before.photo_urls || []).filter((url: string) => !photoUrls.includes(url) && isCloudinaryImageInFolder(url, folder));
    const cleanup = await Promise.allSettled(removedUrls.map((url: string) => deleteImageFromCloudinary(url)));
    return NextResponse.json({ ok: true, photoUrls: saved.photo_urls || [], status: saved.status, cleanupPending: cleanup.some(result => result.status === "rejected" || !result.value) }, { headers });
  }

  if (updateError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/listings/[id]/photos", operation: "set_listing_photos", error: updateError });
    if (isRentalProviderUnverifiedError(updateError)) return NextResponse.json({ error: "Đối tác cần được Admin xác minh trước khi cập nhật ảnh tin cho thuê." }, { status: 403, headers });
    if (updateError.message?.includes("RENTAL_LISTING_PHOTOS_CONFLICT")) return NextResponse.json({ error: "Danh sách ảnh vừa được thay đổi ở nơi khác. Tải lại tin trước khi chỉnh sửa tiếp." }, { status: 409, headers });
    if (updateError.message?.includes("RENTAL_LISTING_NOT_FOUND")) return NextResponse.json({ error: "Không tìm thấy tin thuộc tài khoản này." }, { status: 404, headers });
    return NextResponse.json({ error: "Chưa cập nhật được danh sách ảnh.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  return NextResponse.json({ error: "Danh sách ảnh chưa được lưu như mong đợi. Tải lại tin trước khi thử tiếp." }, { status: 503, headers });
}
