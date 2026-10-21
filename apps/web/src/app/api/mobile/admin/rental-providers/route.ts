import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";

type UserRelation = { email: string | null } | Array<{ email: string | null }> | null;
type RentalProviderRow = {
  id: string;
  provider_name: string;
  provider_type: string;
  contact_name: string;
  contact_phone: string;
  province_code: string | null;
  is_verified: boolean;
  contact_view_limit: number;
  created_at: string;
  users: UserRelation;
};

export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const params = request.nextUrl.searchParams;
  let paging;
  try { paging = parseEmployerListParams(params, []); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tham số danh sách không hợp lệ." }, { status: 400 }); }
  const verified = params.get("verified");
  if (verified !== null && verified !== "true" && verified !== "false") return NextResponse.json({ error: "Giá trị lọc xác minh không hợp lệ." }, { status: 400 });
  const q = (params.get("q") || "").trim().slice(0, 100).replace(/[%,._(),]/g, " ");
  const id = params.get("id") || "";
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Mã đối tác không hợp lệ." }, { status: 400 });
  let query = createSupabaseAdminClient().from("rental_providers")
    .select("id,provider_name,provider_type,contact_name,contact_phone,province_code,is_verified,contact_view_limit,created_at,users!rental_providers_user_id_fkey!inner(email)", { count: "exact" })
    .order("created_at", { ascending: false }).order("id", { ascending: false });
  if (id) query = query.eq("id", id);
  if (verified) query = query.eq("is_verified", verified === "true");
  if (q) query = query.or(`provider_name.ilike.%${q}%,contact_phone.ilike.%${q}%`);
  const { data, count, error } = await query.range(paging.offset, paging.offset + paging.pageSize - 1);
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/rental-providers", operation: "list_rental_providers", error });
    return NextResponse.json({ error: "Chưa tải được danh sách đối tác thuê trọ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const items = ((data || []) as unknown as RentalProviderRow[]).map(({ users, ...provider }) => ({
    ...provider,
    email: Array.isArray(users) ? users[0]?.email : users?.email,
  }));
  const total = count || 0;
  return NextResponse.json({ ok: true, items, total, page: paging.page, pageSize: paging.pageSize, hasMore: paging.page * paging.pageSize < total });
}
