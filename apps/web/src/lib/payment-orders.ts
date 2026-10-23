import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  generateOrderCode,
  isOrderCode,
  type BankAccount,
  type MomoWallet,
  type OrderPaymentView,
  paymentState,
} from "@/lib/payment";
import type { PaymentMethod } from "@/lib/payment-method";

/** Nơi nhận tiền tương ứng phương thức NTD chọn (do Admin bật ở /admin/nhan-tien). */
export interface PaymentDestination {
  paymentAccountId: string | null;
  momoWalletId: string | null;
  account: BankAccount | null;
  wallet: MomoWallet | null;
}

const NO_ACCOUNT = "Kênh nhận tiền đang được cập nhật. Vui lòng liên hệ VEA để được hướng dẫn thanh toán.";

export async function getActivePaymentAccount(): Promise<(BankAccount & { id: string }) | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("payment_accounts")
    .select("id, bank_code, bank_name, account_no, account_name")
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}

export async function getActiveMomoWallet(): Promise<(MomoWallet & { id: string }) | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("momo_wallets")
    .select("id, phone, owner_name, qr_url")
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}

/** MoMo chỉ hiện cho NTD khi Admin đã bật một ví nhận tiền. */
export async function isMomoAvailable(): Promise<boolean> {
  return (await getActiveMomoWallet()) !== null;
}

/**
 * Tìm nơi nhận tiền cho phương thức được chọn. Trả về lỗi khi Admin chưa bật tài khoản /
 * ví nào ‑ không tạo đơn trong trường hợp đó để NTD không ôm đơn không biết chuyển đi đâu.
 */
export async function resolvePaymentDestination(
  method: PaymentMethod,
): Promise<{ destination: PaymentDestination } | { error: string }> {
  if (method === "momo") {
    const wallet = await getActiveMomoWallet();
    if (!wallet) return { error: NO_ACCOUNT };
    return {
      destination: {
        paymentAccountId: null,
        momoWalletId: wallet.id,
        account: null,
        wallet: { phone: wallet.phone, owner_name: wallet.owner_name, qr_url: wallet.qr_url },
      },
    };
  }

  const account = await getActivePaymentAccount();
  if (!account) return { error: NO_ACCOUNT };
  return {
    destination: {
      paymentAccountId: account.id,
      momoWalletId: null,
      account: {
        bank_code: account.bank_code,
        bank_name: account.bank_name,
        account_no: account.account_no,
        account_name: account.account_name,
      },
      wallet: null,
    },
  };
}

/** Mã đơn sinh ngẫu nhiên nên có thể trùng: thử lại vài lần trước khi báo lỗi. */
export async function generateUniqueOrderCode(): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateOrderCode();
    const { data } = await supabase.from("orders").select("id").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  return null;
}

/**
 * Gắn mã đơn + nơi nhận tiền cho một đơn đã được tạo ở nơi khác (đơn gói Chiến dịch do
 * hàm RPC create_employer_job_with_quota insert cùng lúc với tin đăng). Đơn đã có mã thì
 * giữ nguyên mã cũ để nội dung chuyển khoản NTD đã thấy không đổi giữa chừng.
 */
export async function attachPaymentToOrder(
  orderId: string,
  method: PaymentMethod,
): Promise<OrderPaymentView | null> {
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("orders")
    .select(ORDER_PAYMENT_COLUMNS)
    .eq("id", orderId)
    .maybeSingle();
  if (!existing) return null;
  if ((existing as OrderRow).code) return toOrderPaymentView(existing as OrderRow);

  const payment = await preparePaymentForOrder(method);
  if ("error" in payment) return null;

  const { data } = await supabase
    .from("orders")
    .update({
      code: payment.code,
      payment_method: method,
      payment_account_id: payment.destination.paymentAccountId,
      momo_wallet_id: payment.destination.momoWalletId,
    })
    .eq("id", orderId)
    .select(ORDER_PAYMENT_COLUMNS)
    .maybeSingle();
  return data ? toOrderPaymentView(data as OrderRow) : null;
}

export type { OrderPaymentView } from "@/lib/payment";

export interface OrderRow {
  id: string;
  code: string | null;
  order_type: string | null;
  tier: string | null;
  amount: number;
  payment_method: string | null;
  status: string;
  customer_confirmed_at: string | null;
  reject_reason: string | null;
  created_at: string;
  payment_account_id: string | null;
  momo_wallet_id: string | null;
}

export const ORDER_TITLE: Record<string, string> = {
  account_subscription: "Gói tài khoản nhà tuyển dụng",
  finance_inquiry: "Yêu cầu tư vấn tài chính",
  job_post: "Gói tin tuyển dụng",
  sms_blast: "Chiến dịch Blast SMS/Zalo",
  rpo_service: "Dịch vụ RPO",
  banner: "Banner quảng cáo",
};

export function orderTitle(row: { order_type: string | null; tier: string | null }): string {
  const base = ORDER_TITLE[row.order_type ?? ""] ?? "Đơn hàng";
  return row.tier ? `${base} (${row.tier})` : base;
}

/**
 * Dựng màn hình thanh toán cho một đơn. Nơi nhận tiền lấy theo bản ghi gắn lúc tạo đơn;
 * nếu bản ghi đó đã bị xoá thì rơi về tài khoản / ví đang bật để NTD vẫn chuyển được.
 */
export async function toOrderPaymentView(row: OrderRow): Promise<OrderPaymentView> {
  const supabase = createSupabaseAdminClient();
  const method = (row.payment_method ?? "bank_transfer") as PaymentMethod;

  let account: BankAccount | null = null;
  let wallet: MomoWallet | null = null;

  if (method === "momo") {
    const { data } = row.momo_wallet_id
      ? await supabase
          .from("momo_wallets")
          .select("phone, owner_name, qr_url")
          .eq("id", row.momo_wallet_id)
          .maybeSingle()
      : { data: null };
    wallet = data ?? (await getActiveMomoWallet());
  } else {
    const { data } = row.payment_account_id
      ? await supabase
          .from("payment_accounts")
          .select("bank_code, bank_name, account_no, account_name")
          .eq("id", row.payment_account_id)
          .maybeSingle()
      : { data: null };
    account = data ?? (await getActivePaymentAccount());
  }

  const confirmed = row.customer_confirmed_at !== null;
  return {
    id: row.id,
    code: row.code ?? "",
    title: orderTitle(row),
    amountVnd: row.amount,
    method,
    status: row.status,
    state: paymentState(row.status, confirmed),
    confirmed,
    // Lý do Admin trả lại chỉ còn ý nghĩa khi NTD cần chuyển lại (đã bỏ cờ tự báo).
    rejectReason: row.status === "pending" && !confirmed ? row.reject_reason : null,
    createdAt: row.created_at,
    account,
    wallet,
  };
}

/** Các cột cần đọc để dựng OrderPaymentView ‑ dùng chung cho mọi truy vấn đơn hàng. */
export const ORDER_PAYMENT_COLUMNS =
  "id, code, order_type, tier, amount, payment_method, status, customer_confirmed_at, reject_reason, created_at, payment_account_id, momo_wallet_id";

const ORDER_COLUMNS = ORDER_PAYMENT_COLUMNS;

/** Mã đơn + nơi nhận tiền cho một đơn sắp tạo. Lỗi khi Admin chưa bật kênh nhận tiền nào. */
export async function preparePaymentForOrder(
  method: PaymentMethod,
): Promise<{ code: string; destination: PaymentDestination } | { error: string }> {
  const resolved = await resolvePaymentDestination(method);
  if ("error" in resolved) return resolved;
  const code = await generateUniqueOrderCode();
  if (!code) return { error: "Không tạo được mã đơn hàng, vui lòng thử lại." };
  return { code, destination: resolved.destination };
}

/** Xem lại đơn theo mã. Giới hạn trong các đơn của chính NTD đang đăng nhập. */
export async function getOrderPaymentByCode(code: string, employerId: string): Promise<OrderPaymentView | null> {
  if (!isOrderCode(code)) return null;
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("code", code)
    .eq("employer_id", employerId)
    .maybeSingle();
  return data ? toOrderPaymentView(data as OrderRow) : null;
}

export async function getOrderPaymentById(orderId: string, employerId: string): Promise<OrderPaymentView | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", orderId)
    .eq("employer_id", employerId)
    .maybeSingle();
  return data ? toOrderPaymentView(data as OrderRow) : null;
}

/**
 * NTD bấm "Tôi đã thanh toán" (confirmed = true) hoặc hoàn tác. Chỉ đổi được khi đơn còn
 * chờ: đơn đã được Admin xác nhận / huỷ thì bỏ qua để không ghi đè kết quả đối soát.
 * Bấm báo lại sẽ xoá lý do trả lại cũ, tránh NTD thấy cảnh báo của lần chuyển trước.
 */
export async function setOrderCustomerConfirmed(
  code: string,
  employerId: string,
  confirmed: boolean,
): Promise<{ view: OrderPaymentView } | { error: string }> {
  if (!isOrderCode(code)) return { error: "Mã đơn không hợp lệ." };
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .update({
      customer_confirmed_at: confirmed ? new Date().toISOString() : null,
      reject_reason: confirmed ? null : undefined,
    })
    .eq("code", code)
    .eq("employer_id", employerId)
    .eq("status", "pending")
    .select(ORDER_COLUMNS)
    .maybeSingle();

  if (error) return { error: "Không cập nhật được, vui lòng thử lại." };
  if (!data) return { error: "Đơn này đã được xử lý, vui lòng tải lại trang." };
  return { view: await toOrderPaymentView(data as OrderRow) };
}

/** Xem đơn thuê bao thuộc đơn vị đào tạo đã đăng nhập; không dùng employer_id. */
export async function getTrainingProviderOrderPaymentByCode(code: string, providerId: string): Promise<OrderPaymentView | null> {
  if (!isOrderCode(code)) return null;
  const { data } = await createSupabaseAdminClient()
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("code", code)
    .eq("training_provider_id", providerId)
    .maybeSingle();
  return data ? toOrderPaymentView(data as OrderRow) : null;
}

/** Báo/hoàn tác đã chuyển tiền, giới hạn đúng đơn và đúng đơn vị đào tạo. */
export async function setTrainingProviderOrderCustomerConfirmed(
  code: string,
  providerId: string,
  confirmed: boolean,
): Promise<{ view: OrderPaymentView } | { error: string }> {
  if (!isOrderCode(code)) return { error: "Mã đơn không hợp lệ." };
  const { data, error } = await createSupabaseAdminClient()
    .from("orders")
    .update({
      customer_confirmed_at: confirmed ? new Date().toISOString() : null,
      reject_reason: confirmed ? null : undefined,
    })
    .eq("code", code)
    .eq("training_provider_id", providerId)
    .eq("status", "pending")
    .select(ORDER_COLUMNS)
    .maybeSingle();

  if (error) return { error: "Không cập nhật được, vui lòng tải lại đơn." };
  if (!data) return { error: "Đơn này đã được xử lý, vui lòng tải lại trang." };
  return { view: await toOrderPaymentView(data as OrderRow) };
}

/** Xem đơn thuê bao thuộc chủ trọ đã đăng nhập; không dùng employer_id. */
export async function getRentalProviderOrderPaymentByCode(code: string, providerId: string): Promise<OrderPaymentView | null> {
  if (!isOrderCode(code)) return null;
  const { data } = await createSupabaseAdminClient()
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("code", code)
    .eq("rental_provider_id", providerId)
    .maybeSingle();
  return data ? toOrderPaymentView(data as OrderRow) : null;
}

/** Báo/hoàn tác đã chuyển tiền, giới hạn đúng đơn và đúng chủ trọ. */
export async function setRentalProviderOrderCustomerConfirmed(
  code: string,
  providerId: string,
  confirmed: boolean,
): Promise<{ view: OrderPaymentView } | { error: string }> {
  if (!isOrderCode(code)) return { error: "Mã đơn không hợp lệ." };
  const { data, error } = await createSupabaseAdminClient()
    .from("orders")
    .update({
      customer_confirmed_at: confirmed ? new Date().toISOString() : null,
      reject_reason: confirmed ? null : undefined,
    })
    .eq("code", code)
    .eq("rental_provider_id", providerId)
    .eq("status", "pending")
    .select(ORDER_COLUMNS)
    .maybeSingle();

  if (error) return { error: "Không cập nhật được, vui lòng tải lại đơn." };
  if (!data) return { error: "Đơn này đã được xử lý, vui lòng tải lại trang." };
  return { view: await toOrderPaymentView(data as OrderRow) };
}

/** Xem đơn thuê bao thuộc đối tác Bảo hiểm đã đăng nhập; không dùng employer_id. */
export async function getInsuranceProviderOrderPaymentByCode(code: string, providerId: string): Promise<OrderPaymentView | null> {
  if (!isOrderCode(code)) return null;
  const { data } = await createSupabaseAdminClient()
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("code", code)
    .eq("insurance_provider_id", providerId)
    .maybeSingle();
  return data ? toOrderPaymentView(data as OrderRow) : null;
}

/** Báo/hoàn tác đã chuyển tiền, giới hạn đúng đơn và đúng đối tác Bảo hiểm. */
export async function setInsuranceProviderOrderCustomerConfirmed(
  code: string,
  providerId: string,
  confirmed: boolean,
): Promise<{ view: OrderPaymentView } | { error: string }> {
  if (!isOrderCode(code)) return { error: "Mã đơn không hợp lệ." };
  const { data, error } = await createSupabaseAdminClient()
    .from("orders")
    .update({
      customer_confirmed_at: confirmed ? new Date().toISOString() : null,
      reject_reason: confirmed ? null : undefined,
    })
    .eq("code", code)
    .eq("insurance_provider_id", providerId)
    .eq("status", "pending")
    .select(ORDER_COLUMNS)
    .maybeSingle();

  if (error) return { error: "Không cập nhật được, vui lòng tải lại đơn." };
  if (!data) return { error: "Đơn này đã được xử lý, vui lòng tải lại trang." };
  return { view: await toOrderPaymentView(data as OrderRow) };
}

/** Xem đơn thuê bao của đối tác Tài chính đã đăng nhập. */
export async function getFinanceProviderOrderPaymentByCode(code: string, providerId: string): Promise<OrderPaymentView | null> {
  if (!isOrderCode(code)) return null;
  const { data } = await createSupabaseAdminClient().from("orders").select(ORDER_COLUMNS)
    .eq("code", code).eq("finance_provider_id", providerId).maybeSingle();
  return data ? toOrderPaymentView(data as OrderRow) : null;
}

/** Báo/hoàn tác đã chuyển tiền, chỉ cập nhật đúng đơn của đối tác Tài chính. */
export async function setFinanceProviderOrderCustomerConfirmed(
  code: string, providerId: string, confirmed: boolean,
): Promise<{ view: OrderPaymentView } | { error: string }> {
  if (!isOrderCode(code)) return { error: "Mã đơn không hợp lệ." };
  const { data, error } = await createSupabaseAdminClient().from("orders")
    .update({ customer_confirmed_at: confirmed ? new Date().toISOString() : null, reject_reason: confirmed ? null : undefined })
    .eq("code", code).eq("finance_provider_id", providerId).eq("status", "pending")
    .select(ORDER_COLUMNS).maybeSingle();
  if (error) return { error: "Không cập nhật được, vui lòng tải lại đơn." };
  if (!data) return { error: "Đơn này đã được xử lý, vui lòng tải lại trang." };
  return { view: await toOrderPaymentView(data as OrderRow) };
}
