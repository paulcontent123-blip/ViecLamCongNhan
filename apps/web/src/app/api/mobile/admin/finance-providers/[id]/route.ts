import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
const schema = z.object({ verified: z.boolean().optional(), contactViewLimit: z.number().int().min(0).max(100000).optional() }).refine(value => value.verified !== undefined || value.contactViewLimit !== undefined);
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { id } = await context.params; if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã đối tác không hợp lệ." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Thông tin cập nhật không hợp lệ." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  let expectedUpdatedAt: string | undefined;
  if (parsed.data.verified === true) {
    const { data: current, error: currentError } = await supabase.from("finance_providers")
      .select("is_verified,license_number,license_evidence_url,updated_at").eq("id", id).maybeSingle();
    if (currentError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/finance-providers/[id]", operation: "check_provider_license", error: currentError }); return NextResponse.json({ error: "Chưa xác minh được hồ sơ pháp lý của đối tác.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
    if (!current) return NextResponse.json({ error: "Không tìm thấy đối tác tài chính." }, { status: 404 });
    const missing = [!current.license_number?.trim() && "số giấy phép / ủy quyền", !current.license_evidence_url?.trim() && "hồ sơ giấy phép"].filter(Boolean);
    if (missing.length) return NextResponse.json({ error: `Chưa thể xác minh: cần bổ sung ${missing.join(" và ")}.` }, { status: 400 });
    if (current.license_evidence_url.startsWith("private-storage:")) {
      const objectPath = current.license_evidence_url.slice("private-storage:".length);
      if (!objectPath.startsWith(`${id}/`) || objectPath.includes("..")) return NextResponse.json({ error: "Hồ sơ giấy phép không thuộc đơn vị này." }, { status: 400 });
      const filename = objectPath.slice(id.length + 1);
      const { data: files, error: storageError } = await supabase.storage.from("finance-license-evidence").list(id, { search: filename, limit: 2 });
      if (storageError) { const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/finance-providers/[id]", operation: "check_license_file", error: storageError }); return NextResponse.json({ error: "Chưa xác minh được tệp giấy phép.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } }); }
      if (!files?.some(file => file.name === filename)) return NextResponse.json({ error: "Chưa thể xác minh: không tìm thấy tệp hồ sơ giấy phép đã tải lên." }, { status: 400 });
    } else {
      try { if (!/^https?:\/\//i.test(current.license_evidence_url) || !new URL(current.license_evidence_url).hostname) throw new Error(); }
      catch { return NextResponse.json({ error: "Chưa thể xác minh: liên kết hồ sơ giấy phép không hợp lệ." }, { status: 400 }); }
    }
    expectedUpdatedAt = current.updated_at;
  }
  let update = supabase.from("finance_providers").update({
    ...(parsed.data.verified !== undefined ? { is_verified: parsed.data.verified } : {}),
    ...(parsed.data.contactViewLimit !== undefined ? { contact_view_limit: parsed.data.contactViewLimit } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (expectedUpdatedAt) update = update.eq("updated_at", expectedUpdatedAt);
  const { data, error } = await update.select("id,provider_name,is_verified,contact_view_limit,account_type,account_tier_expires_at").maybeSingle();
  if (error) {
    if (error.message.includes("FINANCE_PROVIDER_LICENSE_REQUIRED")) return NextResponse.json({ error: "Chưa thể xác minh: cần bổ sung số giấy phép / ủy quyền và hồ sơ giấy phép." }, { status: 400 });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/finance-providers/[id]", operation: "update_provider", error });
    return NextResponse.json({ error: "Chưa cập nhật được đối tác tài chính.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (expectedUpdatedAt && !data) return NextResponse.json({ error: "Hồ sơ đối tác vừa thay đổi. Tải lại danh sách rồi kiểm tra lại trước khi xác minh." }, { status: 409 });
  if (!data) return NextResponse.json({ error: "Không tìm thấy đối tác tài chính." }, { status: 404 });
  return NextResponse.json({ ok: true, provider: data }, { headers: { "Cache-Control": "private, no-store" } });
}
