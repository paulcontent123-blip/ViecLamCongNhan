import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { consumeRateLimit, rateLimitUnavailable, tooManyRequests } from "@/lib/rate-limit";
import { PROVINCES } from "@/lib/provinces";

const headers = { "Cache-Control": "private, no-store" };
const SERVICES = ["housing", "training", "insurance", "health", "finance"] as const;
const provinceCodes = PROVINCES.map((item) => item.code) as string[];

const schema = z.object({
  workProvinceCode: z.string().refine((value) => provinceCodes.includes(value), "Tỉnh/thành không hợp lệ.").nullable(),
  kcnId: z.string().uuid("Khu công nghiệp không hợp lệ.").nullable(),
  interestedServices: z.array(z.enum(SERVICES)).max(SERVICES.length),
});

const empty = { workProvinceCode: null, kcnId: null, interestedServices: [] as string[] };
const isMissingPreferencesTable = (error: unknown) => !!error && typeof error === "object" &&
  String((error as { code?: unknown }).code ?? "") === "42P01";

export async function GET() {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const { data, error } = await createSupabaseAdminClient().from("candidate_match_preferences")
    .select("work_province_code,kcn_id,interested_services").eq("user_id", session.userId).maybeSingle();
  // Chỉ lỗi bảng không tồn tại ở database mới được xem như chưa áp migration. Lỗi schema-cache PGRST205 vẫn cần kiểm tra.
  if (error && isMissingPreferencesTable(error)) return NextResponse.json({ ok: true, preferences: empty }, { headers });
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/candidate/match-preferences", operation: "load_preferences", error });
    return NextResponse.json({ error: "Chưa tải được tùy chọn gợi ý.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, preferences: data ? { workProvinceCode: data.work_province_code, kcnId: data.kcn_id, interestedServices: data.interested_services ?? [] } : empty }, { headers });
}

export async function PATCH(request: NextRequest) {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Tùy chọn gợi ý không hợp lệ." }, { status: 400, headers });

  const limit = await consumeRateLimit({ scope: "ai-match-prefs", key: session.userId, limit: 20, windowSeconds: 3600 });
  if (!limit.available) return rateLimitUnavailable(limit);
  if (!limit.allowed) return tooManyRequests("Bạn đã đổi tùy chọn quá nhiều lần.", limit.retryAfterSeconds);

  const supabase = createSupabaseAdminClient();
  const { workProvinceCode, kcnId, interestedServices } = parsed.data;
  if (kcnId) {
    const { data: kcn, error } = await supabase.from("kcn").select("id,province_code").eq("id", kcnId).maybeSingle();
    if (error) return NextResponse.json({ error: "Chưa kiểm tra được khu công nghiệp." }, { status: 503, headers });
    if (!kcn || (workProvinceCode && kcn.province_code !== workProvinceCode)) return NextResponse.json({ error: "Khu công nghiệp không thuộc tỉnh/thành đã chọn." }, { status: 400, headers });
  }
  const { error } = await supabase.from("candidate_match_preferences").upsert({
    user_id: session.userId, work_province_code: workProvinceCode, kcn_id: kcnId, interested_services: [...new Set(interestedServices)], updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/candidate/match-preferences", operation: "save_preferences", error });
    return NextResponse.json({ error: "Chưa lưu được tùy chọn gợi ý.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, preferences: { workProvinceCode, kcnId, interestedServices: [...new Set(interestedServices)] } }, { headers });
}
