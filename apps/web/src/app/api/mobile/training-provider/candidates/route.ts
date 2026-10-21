import { NextRequest, NextResponse } from "next/server";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };
const limits: Record<string, number> = { free: 0, basic: 60, premium: 300 };
const cleanFilter = (value: string | null, max: number) => (value ?? "").trim().slice(0, max).replace(/[%,._(),]/g, " ");

export async function GET(request: NextRequest) {
  try {
    const session = await getTrainingProviderSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
    const { page, pageSize, offset } = parseEmployerListParams(request.nextUrl.searchParams, []);
    const params = request.nextUrl.searchParams;
    const province = cleanFilter(params.get("province"), 80);
    const industry = cleanFilter(params.get("industry"), 100);
    const q = cleanFilter(params.get("q"), 100);
    const supabase = createSupabaseAdminClient();
    const { data: provider, error: providerError } = await supabase.from("training_providers")
      .select("is_verified,account_type,account_tier_expires_at")
      .eq("id", session.providerId).maybeSingle();
    if (providerError) throw providerError;
    if (!provider) return NextResponse.json({ error: "Không tìm thấy đơn vị đào tạo." }, { status: 404, headers });
    if (!provider.is_verified) return NextResponse.json({ error: "Đơn vị cần được Admin xác minh trước khi sử dụng Kho học viên." }, { status: 403, headers });

    const expired = provider.account_type !== "free" && provider.account_tier_expires_at && new Date(provider.account_tier_expires_at) <= new Date();
    const tier = expired ? "free" : provider.account_type;
    if (expired) {
      const { error } = await supabase.from("training_providers").update({ account_type: "free", account_tier_expires_at: null })
        .eq("id", session.providerId).eq("account_type", provider.account_type);
      if (error) throw error;
    }
    const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);
    const [{ data: result, error }, { count: viewedCount, error: countError }] = await Promise.all([
      supabase.rpc("list_training_provider_candidate_profiles", {
        p_provider_id: session.providerId, p_province: province || null, p_industry: industry || null,
        p_query: q || null, p_limit: pageSize, p_offset: offset,
      }),
      supabase.from("training_provider_candidate_views").select("user_id", { count: "exact", head: true })
        .eq("provider_id", session.providerId).eq("period_start", periodStart),
    ]);
    if (error) throw error;
    if (countError) throw countError;
    const payload = result as { items?: unknown; total?: unknown } | null;
    if (!payload || !Array.isArray(payload.items) || !Number.isSafeInteger(payload.total)) {
      return NextResponse.json({ error: "Phản hồi Kho học viên không hợp lệ." }, { status: 503, headers });
    }
    const items = payload.items as Record<string, unknown>[];
    if (items.some((item) => !item || typeof item.id !== "string" || typeof item.full_name !== "string" || "phone" in item || "email" in item || "zalo" in item || "user_id" in item)) {
      return NextResponse.json({ error: "Phản hồi Kho học viên chứa trường liên hệ không an toàn." }, { status: 503, headers });
    }
    const total = payload.total as number;
    return NextResponse.json({
      ok: true, items, page, pageSize, total, hasMore: offset + items.length < total,
      usage: { tier, verified: provider.is_verified, viewLimit: limits[tier] ?? 0, viewedCount: viewedCount ?? 0 },
    }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("GET /api/mobile/training-provider/candidates failed:", error);
    return NextResponse.json({ error: "Không tải được Kho học viên." }, { status: 500, headers });
  }
}
