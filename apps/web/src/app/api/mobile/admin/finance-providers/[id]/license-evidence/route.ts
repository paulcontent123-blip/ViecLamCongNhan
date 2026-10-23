import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401, headers });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã đối tác không hợp lệ." }, { status: 400, headers });
  const supabase = createSupabaseAdminClient();
  const { data: provider, error } = await supabase.from("finance_providers").select("license_evidence_url").eq("id", id).maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/finance-providers/[id]/license-evidence", operation: "load_evidence_reference", error });
    return NextResponse.json({ error: "Chưa tải được hồ sơ giấy phép.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  if (!provider?.license_evidence_url) return NextResponse.json({ error: "Đơn vị chưa cung cấp hồ sơ giấy phép." }, { status: 404, headers });

  let url = provider.license_evidence_url;
  if (url.startsWith("private-storage:")) {
    const path = url.slice("private-storage:".length);
    if (!path.startsWith(`${id}/`) || path.includes("..")) return NextResponse.json({ error: "Đường dẫn hồ sơ không hợp lệ." }, { status: 409, headers });
    const { data, error: signError } = await supabase.storage.from("finance-license-evidence").createSignedUrl(path, 120);
    if (signError || !data?.signedUrl) {
      const requestId = signError ? logSafeSupabaseError({ route: "/api/mobile/admin/finance-providers/[id]/license-evidence", operation: "sign_evidence_url", error: signError }) : undefined;
      return NextResponse.json({ error: "Chưa mở được hồ sơ giấy phép.", ...(requestId ? { requestId } : {}) }, { status: 503, headers: requestId ? { ...headers, "X-Request-Id": requestId } : headers });
    }
    url = data.signedUrl;
  }
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: "Địa chỉ hồ sơ giấy phép không hợp lệ." }, { status: 409, headers });
  return NextResponse.json({ ok: true, url }, { headers });
}
