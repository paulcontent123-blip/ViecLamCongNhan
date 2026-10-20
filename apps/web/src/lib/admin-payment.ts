import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Quản lý kênh nhận tiền hiển thị cho NTD: tài khoản ngân hàng (VietQR) và ví MoMo.
 * Mỗi loại chỉ có MỘT bản ghi được bật tại một thời điểm (unique index trong migration
 * 20261020100001) ‑ bật cái mới thì phải tắt cái cũ trong cùng thao tác. */

export interface PaymentAccountRow {
  id: string;
  bank_code: string;
  bank_name: string;
  account_no: string;
  account_name: string;
  is_active: boolean;
  created_at: string;
}

export interface MomoWalletRow {
  id: string;
  phone: string;
  owner_name: string;
  qr_url: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
}

const ACCOUNT_COLUMNS = "id, bank_code, bank_name, account_no, account_name, is_active, created_at";
const WALLET_COLUMNS = "id, phone, owner_name, qr_url, note, is_active, created_at";

export async function listPaymentAccounts(): Promise<PaymentAccountRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("payment_accounts")
    .select(ACCOUNT_COLUMNS)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as PaymentAccountRow[] | null) ?? [];
}

export async function listMomoWallets(): Promise<MomoWalletRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("momo_wallets")
    .select(WALLET_COLUMNS)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as MomoWalletRow[] | null) ?? [];
}

export interface PaymentAccountInput {
  bankCode: string;
  bankName: string;
  accountNo: string;
  accountName: string;
}

/** Thêm tài khoản nhận tiền. Tài khoản đầu tiên tự được bật để NTD thanh toán được ngay. */
export async function createPaymentAccount(input: PaymentAccountInput) {
  const supabase = createSupabaseAdminClient();
  const { data: active } = await supabase.from("payment_accounts").select("id").eq("is_active", true).maybeSingle();
  const { data, error } = await supabase
    .from("payment_accounts")
    .insert({
      bank_code: input.bankCode,
      bank_name: input.bankName,
      account_no: input.accountNo.replace(/\s/g, ""),
      account_name: input.accountName.trim().toUpperCase(),
      is_active: !active,
    })
    .select(ACCOUNT_COLUMNS)
    .single();
  if (error || !data) return { error: "Không lưu được tài khoản nhận tiền." };
  return { account: data as PaymentAccountRow };
}

export async function updatePaymentAccount(id: string, input: PaymentAccountInput) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("payment_accounts")
    .update({
      bank_code: input.bankCode,
      bank_name: input.bankName,
      account_no: input.accountNo.replace(/\s/g, ""),
      account_name: input.accountName.trim().toUpperCase(),
    })
    .eq("id", id)
    .select(ACCOUNT_COLUMNS)
    .maybeSingle();
  if (error || !data) return { error: "Không tìm thấy tài khoản nhận tiền." };
  return { account: data as PaymentAccountRow };
}

/** Bật một tài khoản: tắt tài khoản đang bật trước, vì chỉ một cái được hiện cho NTD. */
export async function activatePaymentAccount(id: string) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("payment_accounts").update({ is_active: false }).eq("is_active", true);
  const { data, error } = await supabase
    .from("payment_accounts")
    .update({ is_active: true })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Không tìm thấy tài khoản nhận tiền." };
  return { ok: true as const };
}

/** Xoá tài khoản; đang bật thì bật tài khoản mới nhất còn lại để NTD không mất kênh trả tiền. */
export async function deletePaymentAccount(id: string) {
  const supabase = createSupabaseAdminClient();
  const { data: removed } = await supabase
    .from("payment_accounts")
    .delete()
    .eq("id", id)
    .select("is_active")
    .maybeSingle();
  if (removed?.is_active) {
    const { data: next } = await supabase
      .from("payment_accounts")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (next) await supabase.from("payment_accounts").update({ is_active: true }).eq("id", next.id);
  }
  return { ok: true as const };
}

export interface MomoWalletInput {
  phone: string;
  ownerName: string;
  qrUrl?: string | null;
  note?: string | null;
}

function walletPayload(input: MomoWalletInput) {
  return {
    phone: input.phone.replace(/[\s.()-]/g, ""),
    owner_name: input.ownerName.trim().toUpperCase(),
    qr_url: input.qrUrl?.trim() || null,
    note: input.note?.trim() || null,
  };
}

export async function createMomoWallet(input: MomoWalletInput) {
  const supabase = createSupabaseAdminClient();
  const { data: active } = await supabase.from("momo_wallets").select("id").eq("is_active", true).maybeSingle();
  const { data, error } = await supabase
    .from("momo_wallets")
    .insert({ ...walletPayload(input), is_active: !active })
    .select(WALLET_COLUMNS)
    .single();
  if (error || !data) return { error: "Không lưu được ví MoMo." };
  return { wallet: data as MomoWalletRow };
}

export async function updateMomoWallet(id: string, input: MomoWalletInput) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("momo_wallets")
    .update(walletPayload(input))
    .eq("id", id)
    .select(WALLET_COLUMNS)
    .maybeSingle();
  if (error || !data) return { error: "Không tìm thấy ví MoMo." };
  return { wallet: data as MomoWalletRow };
}

/** Bật / tắt ví. Tắt hết ví thì NTD không còn thấy lựa chọn MoMo (hiện "Sắp có"). */
export async function setMomoWalletActive(id: string, active: boolean) {
  const supabase = createSupabaseAdminClient();
  if (active) await supabase.from("momo_wallets").update({ is_active: false }).eq("is_active", true);
  const { data, error } = await supabase
    .from("momo_wallets")
    .update({ is_active: active })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Không tìm thấy ví MoMo." };
  return { ok: true as const };
}

export async function deleteMomoWallet(id: string) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("momo_wallets").delete().eq("id", id);
  return { ok: true as const };
}
