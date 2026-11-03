import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { AD_CONFLICT_MESSAGE, AD_FIELDS, adColumns, adUpdateSchema, findSlotConflict, toAdminAd, validAdId, type AdRow } from "@/lib/ads";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const headers = { "Cache-Control": "private, no-store" };

// Sửa quảng cáo: app Admin gửi lại toàn bộ nội dung. Không đổi vị trí của quảng cáo đã có (xóa và tạo mới nếu cần).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!validAdId(id)) return NextResponse.json({ error: "Quảng cáo không hợp lệ." }, { status: 400, headers });
  const parsed = adUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin quảng cáo chưa hợp lệ." }, { status: 400, headers });
  const columns = adColumns(parsed.data);

  try {
    const supabase = createSupabaseAdminClient();
    const current = await supabase.from("ads").select("id, placement").eq("id", id).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return NextResponse.json({ error: "Không tìm thấy quảng cáo." }, { status: 404, headers });
    if (current.data.placement !== columns.placement) return NextResponse.json({ error: "Không đổi được vị trí của quảng cáo đã tạo. Hãy tạo quảng cáo mới." }, { status: 400, headers });

    if (columns.kcn_ids.length > 0) {
      const found = await supabase.from("kcn").select("id", { count: "exact", head: true }).in("id", columns.kcn_ids);
      if (found.error) throw found.error;
      if (found.count !== columns.kcn_ids.length) return NextResponse.json({ error: "Có KCN không tồn tại." }, { status: 400, headers });
    }
    const sameSlot = await supabase.from("ads").select(AD_FIELDS).eq("placement", columns.placement).eq("status", "active");
    if (sameSlot.error) throw sameSlot.error;
    if (findSlotConflict({ id, ...columns }, (sameSlot.data ?? []) as unknown as AdRow[])) return NextResponse.json({ error: AD_CONFLICT_MESSAGE }, { status: 409, headers });

    const { data, error } = await supabase.from("ads").update({ ...columns, updated_at: new Date().toISOString() }).eq("id", id).select(AD_FIELDS).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Không tìm thấy quảng cáo." }, { status: 404, headers });
    await logAdminAction(auth.session, "ad.update", { type: "ad", id }, { placement: columns.placement, status: columns.status });
    return NextResponse.json({ ok: true, item: toAdminAd(data as unknown as AdRow) }, { headers });
  } catch (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/ads/[id]", operation: "update_ad", error });
    return NextResponse.json({ error: "Chưa lưu được thay đổi.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
}

// Xóa hẳn quảng cáo (muốn chỉ ngừng hiển thị thì tạm dừng).
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!validAdId(id)) return NextResponse.json({ error: "Quảng cáo không hợp lệ." }, { status: 400, headers });
  const { data, error } = await createSupabaseAdminClient().from("ads").delete().eq("id", id).select("id, placement").maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/ads/[id]", operation: "delete_ad", error });
    return NextResponse.json({ error: "Chưa xóa được quảng cáo.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Không tìm thấy quảng cáo." }, { status: 404, headers });
  await logAdminAction(auth.session, "ad.delete", { type: "ad", id }, { placement: data.placement });
  return NextResponse.json({ ok: true }, { headers });
}
