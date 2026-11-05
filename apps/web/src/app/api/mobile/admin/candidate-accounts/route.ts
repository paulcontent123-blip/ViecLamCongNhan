import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

// Danh sách tài khoản công nhân để Admin xác nhận. Route MỚI, không thay đổi route nào đang có.
// Công nhân đăng ký bằng số điện thoại + mật khẩu nên `users.is_verified = false` cho tới khi Admin xác nhận.
//  GET ?status=pending|verified&q=&page&pageSize

const headers = { "Cache-Control": "private, no-store" };
const FIELDS = "id,full_name,phone,is_verified,created_at";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin("admin_users");
  if (auth.error) {
    auth.error.headers.set("Cache-Control", headers["Cache-Control"]);
    return auth.error;
  }
  try {
    const { page, pageSize, offset, status } = parseEmployerListParams(request.nextUrl.searchParams, ["pending", "verified"]);
    // Bỏ ký tự có nghĩa với bộ lọc PostgREST (dấu phẩy, ngoặc, %, _) để ô tìm kiếm không phá câu lọc.
    const q = (request.nextUrl.searchParams.get("q") ?? "").replace(/[,()%_*\\]/g, " ").trim().slice(0, 60);

    const supabase = createSupabaseAdminClient();
    let list = supabase.from("users").select(FIELDS, { count: "exact" })
      .eq("role", "candidate").eq("status", "active")
      .order("created_at", { ascending: false }).order("id", { ascending: false });
    if (status) list = list.eq("is_verified", status === "verified");
    if (q) list = list.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);

    const [result, pending] = await Promise.all([
      list.range(offset, offset + pageSize - 1),
      supabase.from("users").select("id", { count: "exact", head: true })
        .eq("role", "candidate").eq("status", "active").eq("is_verified", false),
    ]);
    if (result.error) throw result.error;
    if (pending.error) throw pending.error;
    if (result.count === null) throw new Error("Missing candidate account count");

    return NextResponse.json(
      { ok: true, items: result.data ?? [], total: result.count, pendingCount: pending.count ?? 0, page, pageSize },
      { headers },
    );
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/candidate-accounts", operation: "list_accounts", error });
    return NextResponse.json(
      { error: "Chưa tải được danh sách tài khoản công nhân.", requestId },
      { status: 503, headers: { ...headers, "X-Request-Id": requestId } },
    );
  }
}
