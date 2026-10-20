import { NextRequest, NextResponse } from "next/server";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";

const statuses = ["new", "viewed", "contacted", "accepted", "rejected"] as const;
const packageLimits: Record<string, number> = { free: 0, basic: 60, premium: 300 };
type VocationalApplicationRow = {
  id: string;
  course_id: string;
  full_name: string;
  status: string;
  message: string | null;
  created_at: string;
  updated_at: string;
  vocational_courses: { title: string } | { title: string }[] | null;
};

export async function GET(request: NextRequest) {
  const session = await getTrainingProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const params = request.nextUrl.searchParams;
  let paging;
  try { paging = parseEmployerListParams(params, statuses); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số danh sách không hợp lệ." }, { status: 400 }); }

  const id = params.get("id") || "";
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã hồ sơ không hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);

  const { data: provider, error: providerError } = await supabase.from("training_providers")
    .select("is_verified,account_type,account_tier_expires_at")
    .eq("id", session.providerId).maybeSingle();
  if (providerError) return NextResponse.json({ error: "Chưa tải được quyền tài khoản đào tạo." }, { status: 500 });
  if (!provider) return NextResponse.json({ error: "Không tìm thấy đơn vị đào tạo." }, { status: 404 });

  const expired = provider.account_type !== "free" && provider.account_tier_expires_at && new Date(provider.account_tier_expires_at) <= now;
  const tier = expired ? "free" : provider.account_type;
  const viewLimit = provider.is_verified ? packageLimits[tier] ?? 0 : 0;
  const { count: viewedCount, error: countError } = await supabase.from("training_provider_application_contact_views")
    .select("application_id", { count: "exact", head: true })
    .eq("provider_id", session.providerId).eq("period_start", periodStart);
  if (countError) return NextResponse.json({ error: "Chưa tải được hạn mức xem liên hệ." }, { status: 500 });

  let query = supabase.from("vocational_applications")
    .select("id,course_id,full_name,status,message,created_at,updated_at,vocational_courses(title)", { count: "exact" })
    .eq("provider_id", session.providerId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (id) query = query.eq("id", id);
  if (paging.status) query = query.eq("status", paging.status);
  const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._(),]/g, " ");
  if (q) query = query.or(`full_name.ilike.%${q}%,message.ilike.%${q}%`);

  const { data, count, error } = await query.range((paging.page - 1) * paging.pageSize, paging.page * paging.pageSize - 1);
  if (error) return NextResponse.json({ error: "Chưa tải được hồ sơ học viên." }, { status: 500 });
  const total = count || 0;
  const rows = (data || []) as unknown as VocationalApplicationRow[];
  const items = rows.map((item) => ({
    ...item,
    course_title: Array.isArray(item.vocational_courses) ? item.vocational_courses[0]?.title : item.vocational_courses?.title,
    vocational_courses: undefined,
  }));
  return NextResponse.json({
    ok: true, items, total, page: paging.page, pageSize: paging.pageSize,
    hasMore: paging.page * paging.pageSize < total,
    usage: { tier, verified: provider.is_verified, viewLimit, viewedCount: viewedCount || 0 },
  });
}
