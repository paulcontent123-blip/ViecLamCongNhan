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

/** Ảnh của nhà tuyển dụng / đối tác (logo, ảnh tin cho thuê). Phải lấy TRƯỚC khi gọi delete_business_account vì hàm SQL xóa URL trong dữ liệu. */
export async function collectBusinessImageUrls(userId: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const [employer, training, insurance, finance, health, rental] = await Promise.all([
    supabase.from("employers").select("company_logo_url").eq("user_id", userId),
    supabase.from("training_providers").select("logo_url").eq("user_id", userId),
    supabase.from("insurance_providers").select("logo_url").eq("user_id", userId),
    supabase.from("finance_providers").select("logo_url").eq("user_id", userId),
    supabase.from("health_providers").select("logo_url").eq("user_id", userId),
    supabase.from("rental_providers").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  const photos = rental.data?.id
    ? ((await supabase.from("rental_listings").select("photo_urls").eq("provider_id", rental.data.id)).data ?? [])
        .flatMap((row) => (row.photo_urls as string[] | null) ?? [])
    : [];
  return [
    ...(employer.data ?? []).map((row) => row.company_logo_url as string | null),
    ...[training, insurance, finance, health].flatMap((result) => (result.data ?? []).map((row) => row.logo_url as string | null)),
    ...photos,
  ].filter((url): url is string => typeof url === "string" && url.length > 0);
}

/** Dọn ảnh là việc phụ: lỗi Cloudinary không làm hỏng việc xóa tài khoản đã hoàn tất. */
export async function deleteCloudinaryImages(urls: string[]): Promise<void> {
  await Promise.allSettled(urls.map((url) => deleteImageFromCloudinary(url)));
}
