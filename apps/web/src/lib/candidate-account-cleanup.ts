import "server-only";
import { deleteImageFromCloudinary } from "@/lib/cloudinary";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Ảnh của công nhân trên Cloudinary (avatar, ảnh tin Chợ). Phải lấy TRƯỚC khi xóa vì hàm SQL xóa luôn các dòng chứa URL. */
export async function collectCandidateImageUrls(userId: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const [avatarResult, listingResult] = await Promise.all([
    supabase.from("candidates").select("avatar_url").eq("user_id", userId),
    supabase.from("secondhand_marketplace_listings").select("photo_urls").eq("seller_user_id", userId),
  ]);
  return [
    ...(avatarResult.data ?? []).map((row) => row.avatar_url as string | null),
    ...(listingResult.data ?? []).flatMap((row) => (row.photo_urls as string[] | null) ?? []),
  ].filter((url): url is string => typeof url === "string" && url.length > 0);
}

/** Dọn ảnh là việc phụ: lỗi Cloudinary không làm hỏng việc xóa tài khoản đã hoàn tất. */
export async function deleteCloudinaryImages(urls: string[]): Promise<void> {
  await Promise.allSettled(urls.map((url) => deleteImageFromCloudinary(url)));
}
