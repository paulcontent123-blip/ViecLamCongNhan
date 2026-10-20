import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase phía server, dùng ANON key và tôn trọng RLS.
 * Dùng trong Server Components / Route Handlers để đọc dữ liệu công khai
 * (jobs đã duyệt, kcn, revenue_partners active).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Gọi từ Server Component (không thể set cookie) ‑ bỏ qua,
            // middleware sẽ đảm nhiệm việc refresh session nếu cần.
          }
        },
      },
    },
  );
}
