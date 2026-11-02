import "server-only";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ForwardState = "yes" | "no" | "error";

/**
 * Đối tác chỉ được mở liên hệ của yêu cầu mà Admin đã chuyển cho họ (routed_to = 'provider').
 * Hàm SQL mở liên hệ không biết về routed_to, nên các route mở liên hệ phải kiểm tra bước này trước khi gọi.
 */
export async function inquiryForwardedToProvider(table: string, id: string, providerId: string): Promise<ForwardState> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return "no";
  const { data, error } = await createSupabaseAdminClient().from(table).select("routed_to").eq("id", id).eq("provider_id", providerId).maybeSingle();
  if (error) return "error";
  return data?.routed_to === "provider" ? "yes" : "no";
}

export function notForwardedResponse(state: Exclude<ForwardState, "yes">) {
  return NextResponse.json(
    { error: state === "no" ? "Không tìm thấy yêu cầu." : "Chưa kiểm tra được yêu cầu. Thông tin liên hệ chưa được mở." },
    { status: state === "no" ? 404 : 503, headers: { "Cache-Control": "private, no-store" } },
  );
}
