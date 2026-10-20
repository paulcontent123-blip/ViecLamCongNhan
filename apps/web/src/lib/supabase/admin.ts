import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase dùng SERVICE ROLE key ‑ bypass RLS hoàn toàn.
 * CHỈ import trong code chạy trên server (Route Handlers, Server Actions).
 * `server-only` sẽ làm build fail nếu module này lỡ bị import vào Client Component.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
