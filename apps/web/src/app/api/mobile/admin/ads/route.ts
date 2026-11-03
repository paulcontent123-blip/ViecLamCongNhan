import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { AD_CONFLICT_MESSAGE, AD_FIELDS, AD_PLACEMENTS, adColumns, adCreateSchema, findSlotConflict, toAdminAd, type AdRow } from "@/lib/ads";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const headers = { "Cache-Control": "private, no-store" };

// Danh sách quảng cáo cho Admin (Biên tập và Superadmin): mới nhất trước, lọc theo vị trí.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) { auth.error.headers.set("Cache-Control", headers["Cache-Control"]); return auth.error; }
  try {
    const { page, pageSize, offset } = parseEmployerListParams(request.nextUrl.searchParams, []);
    const placement = request.nextUrl.searchParams.get("placement");
    if (placement !== null && placement !== "" && !(AD_PLACEMENTS as readonly string[]).includes(placement)) throw new RangeError("Vị trí không hợp lệ.");
    let list = createSupabaseAdminClient().from("ads").select(AD_FIELDS, { count: "exact" }).order("ends_on", { ascending: false }).order("id", { ascending: false });
    if (placement) list = list.eq("placement", placement);
    const result = await list.range(offset, offset + pageSize - 1);
    if (result.error) throw result.error;
    if (result.count === null) throw new Error("Missing ad count");
    const items = ((result.data ?? []) as unknown as AdRow[]).map((row) => toAdminAd(row));
    return NextResponse.json({ ok: true, items, total: result.count, page, pageSize }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/ads", operation: "list_ads", error });
    return NextResponse.json({ error: "Chưa tải được quảng cáo.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
}

// Tạo quảng cáo. Từ chối khi vị trí một chỗ (banner, sidebar) đã có quảng cáo khác trùng thời gian, kênh và KCN.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) { auth.error.headers.set("Cache-Control", headers["Cache-Control"]); return auth.error; }
  const parsed = adCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin quảng cáo chưa hợp lệ." }, { status: 400, headers });
  const columns = adColumns(parsed.data);

  try {
    const supabase = createSupabaseAdminClient();
    if (columns.kcn_ids.length > 0) {
      const found = await supabase.from("kcn").select("id", { count: "exact", head: true }).in("id", columns.kcn_ids);
      if (found.error) throw found.error;
      if (found.count !== columns.kcn_ids.length) return NextResponse.json({ error: "Có KCN không tồn tại." }, { status: 400, headers });
    }
    const sameSlot = await supabase.from("ads").select(AD_FIELDS).eq("placement", columns.placement).eq("status", "active");
    if (sameSlot.error) throw sameSlot.error;
    if (findSlotConflict(columns, (sameSlot.data ?? []) as unknown as AdRow[])) return NextResponse.json({ error: AD_CONFLICT_MESSAGE }, { status: 409, headers });

    const { data, error } = await supabase.from("ads").insert({ ...columns, created_by: auth.session.userId }).select(AD_FIELDS).single();
    if (error) throw error;
    await logAdminAction(auth.session, "ad.create", { type: "ad", id: data.id }, { placement: columns.placement });
    return NextResponse.json({ ok: true, item: toAdminAd(data as unknown as AdRow) }, { status: 201, headers });
  } catch (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/ads", operation: "create_ad", error });
    return NextResponse.json({ error: "Chưa lưu được quảng cáo.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
}
