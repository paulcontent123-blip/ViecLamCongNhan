import "server-only";
import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

// Giới hạn tần suất dùng chung (bảng api_rate_events + hàm consume_rate_limit). Khóa được băm HMAC nên không lưu IP, SĐT hay email thô.
// Nếu không kiểm tra được hạn mức, caller phải tạm dừng yêu cầu thay vì bỏ qua lớp chống spam.

export interface RateRule { scope: string; key: string; limit: number; windowSeconds: number }
export interface RateResult { allowed: boolean; available: boolean; retryAfterSeconds: number; requestId?: string }

function hashKey(scope: string, key: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("ADMIN_SESSION_SECRET chưa được cấu hình đủ mạnh.");
  return createHmac("sha256", secret).update(`rate:${scope}:${key}`).digest("hex");
}

export async function consumeRateLimit(rule: RateRule): Promise<RateResult> {
  try {
    const { data, error } = await createSupabaseAdminClient().rpc("consume_rate_limit", {
      p_scope: rule.scope, p_key_hash: hashKey(rule.scope, rule.key), p_limit: rule.limit, p_window_seconds: rule.windowSeconds,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== "boolean") throw new Error("Phản hồi giới hạn tần suất không hợp lệ.");
    return { allowed: row.allowed, available: true, retryAfterSeconds: Number(row.retry_after_seconds) || 0 };
  } catch (error) {
    const requestId = logSafeSupabaseError({ route: "rate-limit", operation: rule.scope, error });
    return { allowed: false, available: false, retryAfterSeconds: 0, requestId };
  }
}

/** Kiểm tra lần lượt nhiều quy tắc; dừng ở quy tắc đầu tiên bị chặn. Mỗi quy tắc cho qua đều đã ghi một lượt. */
export async function consumeAll(rules: RateRule[]): Promise<RateResult> {
  for (const rule of rules) {
    const result = await consumeRateLimit(rule);
    if (!result.allowed) return result;
  }
  return { allowed: true, available: true, retryAfterSeconds: 0 };
}

export function rateLimitUnavailable(result: RateResult): NextResponse {
  return NextResponse.json({ error: "Tạm thời chưa kiểm tra được giới hạn yêu cầu. Vui lòng thử lại sau.", requestId: result.requestId }, {
    status: 503,
    headers: { "Cache-Control": "no-store", ...(result.requestId ? { "X-Request-Id": result.requestId } : {}) },
  });
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function retryText(seconds: number): string {
  if (seconds < 90) return `${Math.max(1, Math.ceil(seconds))} giây`;
  if (seconds < 5400) return `${Math.ceil(seconds / 60)} phút`;
  return `${Math.ceil(seconds / 3600)} giờ`;
}

export function tooManyRequests(message: string, retryAfterSeconds: number): NextResponse {
  return NextResponse.json({ error: `${message} Vui lòng thử lại sau ${retryText(retryAfterSeconds)}.`, retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))), "Cache-Control": "no-store" } });
}
