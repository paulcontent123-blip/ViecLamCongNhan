"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase phía trình duyệt, dùng ANON key và tôn trọng RLS.
 * Chỉ đọc được dữ liệu công khai (jobs đã duyệt, kcn, revenue_partners active)
 * theo policy đã định nghĩa trong supabase/migrations.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
