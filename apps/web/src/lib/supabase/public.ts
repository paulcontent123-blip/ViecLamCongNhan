import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase công khai ‑ ANON key, tôn trọng RLS, KHÔNG đọc cookie.
 *
 * Khác createSupabaseServerClient ở chỗ không chạm vào cookies(), nhờ vậy các
 * route dùng nó (sitemap.xml) vẫn cache được thay vì bị Next ép render động
 * mỗi lần bot gọi tới.
 */
export function createSupabasePublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
