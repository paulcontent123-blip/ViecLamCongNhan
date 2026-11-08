import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";

// "Dịch vụ đã đặt" của các loại Đối tác (cùng nguồn service_inquiries với nhà tuyển dụng):
// yêu cầu được khớp theo số điện thoại của tài khoản đối tác (số liên hệ của đơn vị và số trên tài khoản đăng nhập).
// userId luôn lấy từ phiên đã xác thực ở route gọi vào, không nhận từ client.
export const PROVIDER_INQUIRY_TABLES = ["training_providers", "rental_providers", "insurance_providers", "finance_providers", "health_providers"] as const;
export type ProviderInquiryTable = (typeof PROVIDER_INQUIRY_TABLES)[number];

const SELECT = "id, type, service_name, company_name, phone, email, request, kcn_target, cancel_reason, status, created_at, consulted_at";
const MAX_ITEMS = 100;
const headers = { "Cache-Control": "private, no-store" };

// Hai truy vấn riêng, KHÔNG nhúng users(...) vào truy vấn bảng đối tác: mỗi bảng đối tác có hai đường tới users
// (trực tiếp qua user_id và vòng qua bảng yêu cầu có provider_id + user_id) nên PostgREST báo "nhiều quan hệ" (PGRST201).
async function phoneKeys(table: ProviderInquiryTable, userId: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data: provider, error } = await supabase.from(table).select("contact_phone").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!provider) return [];
  const { data: account, error: accountError } = await supabase.from("users").select("phone").eq("id", userId).maybeSingle();
  if (accountError) throw accountError;
  return [...new Set([provider.contact_phone, account?.phone].map((phone) => normalizePhone(phone ?? "")).filter(Boolean))];
}

export async function providerServiceInquiriesResponse(
  getSession: () => Promise<{ userId: string } | null>,
  table: ProviderInquiryTable,
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
    const keys = await phoneKeys(table, session.userId);
    if (keys.length === 0) return NextResponse.json({ ok: true, items: [], total: 0 }, { headers });
    const { data, error, count } = await createSupabaseAdminClient().from("service_inquiries")
      .select(SELECT, { count: "exact" })
      .in("phone_normalized", keys)
      .order("created_at", { ascending: false })
      .limit(MAX_ITEMS);
    if (error) throw error;
    return NextResponse.json({ ok: true, items: data ?? [], total: count ?? (data ?? []).length }, { headers });
  } catch (error) {
    console.error(`GET service-inquiries (${table}) failed:`, error);
    return NextResponse.json({ error: "Không tải được dịch vụ đã đặt." }, { status: 500, headers });
  }
}
