/** Dùng chung server + client: ngân hàng VietQR, link ảnh QR, trạng thái hiển thị của đơn. */

/** Mã ngân hàng theo VietQR (https://api.vietqr.io/v2/banks), các ngân hàng phổ biến. */
export const BANKS = [
  { code: "VCB", name: "Vietcombank" },
  { code: "MB", name: "MB Bank" },
  { code: "TCB", name: "Techcombank" },
  { code: "ACB", name: "ACB" },
  { code: "BIDV", name: "BIDV" },
  { code: "CTG", name: "VietinBank" },
  { code: "VPB", name: "VPBank" },
  { code: "TPB", name: "TPBank" },
  { code: "STB", name: "Sacombank" },
  { code: "VIB", name: "VIB" },
  { code: "SHB", name: "SHB" },
  { code: "MSB", name: "MSB" },
  { code: "OCB", name: "OCB" },
  { code: "HDB", name: "HDBank" },
  { code: "EIB", name: "Eximbank" },
  { code: "SEAB", name: "SeABank" },
  { code: "LPB", name: "LPBank" },
  { code: "NAB", name: "Nam A Bank" },
  { code: "VBA", name: "Agribank" },
] as const;

export function bankName(code: string): string {
  return BANKS.find((b) => b.code === code)?.name ?? code;
}

export interface BankAccount {
  bank_code: string;
  bank_name: string;
  account_no: string;
  account_name: string;
}

export interface MomoWallet {
  phone: string;
  owner_name: string;
  qr_url: string | null;
}

/** Ảnh QR VietQR điền sẵn số tiền + nội dung chuyển khoản (img.vietqr.io, không cần khóa API). */
export function vietQrUrl(account: BankAccount, amountVnd: number, content: string): string {
  const query = new URLSearchParams({
    amount: String(amountVnd),
    addInfo: content,
    accountName: account.account_name,
  });
  return `https://img.vietqr.io/image/${account.bank_code}-${account.account_no}-compact2.png?${query}`;
}

/** Trạng thái hiển thị: suy ra từ orders.status + việc NTD đã bấm "Tôi đã thanh toán" hay chưa. */
export type PaymentState = "unpaid" | "awaiting" | "paid" | "cancelled" | "refunded";

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  unpaid: "Chưa thanh toán",
  awaiting: "Đã thanh toán, chờ xác nhận",
  paid: "Đã nhận tiền",
  cancelled: "Đã huỷ",
  refunded: "Đã hoàn tiền",
};

export const PAYMENT_STATE_TONE: Record<PaymentState, "amber" | "green" | "gray" | "blue"> = {
  unpaid: "gray",
  awaiting: "amber",
  paid: "green",
  cancelled: "gray",
  refunded: "blue",
};

export function paymentState(status: string, customerConfirmed: boolean): PaymentState {
  if (status !== "pending") return status as PaymentState;
  return customerConfirmed ? "awaiting" : "unpaid";
}

/** Mã đơn = nội dung chuyển khoản. Bỏ các ký tự dễ đọc nhầm (0/O, 1/I) để NTD gõ tay không sai. */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateOrderCode(): string {
  let code = "VL";
  for (let i = 0; i < 6; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export const ORDER_CODE_PATTERN = /^VL[A-Z0-9]{6}$/;

/** Màn hình thanh toán của một đơn ‑ API trả về, client render. */
export interface OrderPaymentView {
  id: string;
  code: string;
  title: string;
  amountVnd: number;
  method: string;
  status: string;
  state: PaymentState;
  confirmed: boolean;
  rejectReason: string | null;
  createdAt: string;
  account: BankAccount | null;
  wallet: MomoWallet | null;
}

export function isOrderCode(value: string): boolean {
  return ORDER_CODE_PATTERN.test(value);
}
