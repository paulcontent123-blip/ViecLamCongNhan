import "server-only";
import { redirect } from "next/navigation";
import { getFinanceProviderSession } from "@/lib/finance-provider-auth";
import { getInsuranceProviderSession } from "@/lib/insurance-provider-auth";
import { getRentalProviderSession } from "@/lib/rental-provider-auth";
import { ROUTES } from "@/lib/routes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Chặn các trang trong khu quản lý của Bảo hiểm, Tài chính và Thuê trọ.
 *
 * Middleware chỉ bảo vệ `/admin` và `/tuyen-dung/dashboard`, nên mỗi trang tự chặn ở đây thay vì sửa `middleware.ts`.
 * Chặn thật vẫn nằm ở máy chủ: mọi route `api/mobile/*-provider/*` tự kiểm tra phiên và trả 401.
 */
export async function requireInsuranceProviderPage() {
  const session = await getInsuranceProviderSession();
  if (!session) redirect(ROUTES.baoHiemDoiTacLogin);
  return session;
}

export async function requireFinanceProviderPage() {
  const session = await getFinanceProviderSession();
  if (!session) redirect(ROUTES.taiChinhDoiTacLogin);
  return session;
}

export async function requireRentalProviderPage() {
  const session = await getRentalProviderSession();
  if (!session) redirect(ROUTES.thueTroDoiTacLogin);
  return session;
}

/**
 * Đơn vị đã được Admin xác minh chưa. Đọc hỏng thì coi như CHƯA xác minh: thà khoá nhầm còn hơn mời người dùng
 * bấm vào chỗ máy chủ sẽ từ chối.
 */
export async function getProviderVerified(
  table: "insurance_providers" | "finance_providers" | "rental_providers",
  providerId: string,
): Promise<boolean> {
  const { data } = await createSupabaseAdminClient().from(table).select("is_verified").eq("id", providerId).maybeSingle();
  return data?.is_verified === true;
}
