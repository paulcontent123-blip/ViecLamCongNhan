import { z } from "zod";
import { BANKS } from "@/lib/payment";

/** Ràng buộc dữ liệu kênh nhận tiền ‑ khớp CHECK constraint trong migration 20261020100001. */

const BANK_CODES = BANKS.map((b) => b.code) as [string, ...string[]];

export const paymentAccountSchema = z.object({
  bankCode: z.enum(BANK_CODES, { message: "Vui lòng chọn ngân hàng." }),
  bankName: z.string().trim().min(2, "Tên ngân hàng tối thiểu 2 ký tự.").max(100),
  accountNo: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ""))
    .refine((v) => /^\d{6,20}$/.test(v), "Số tài khoản chỉ gồm 6-20 chữ số."),
  accountName: z.string().trim().min(2, "Tên chủ tài khoản tối thiểu 2 ký tự.").max(100),
});

export const momoWalletSchema = z.object({
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s.()-]/g, ""))
    .refine((v) => /^0\d{9}$/.test(v), "Số điện thoại ví MoMo phải gồm 10 chữ số, bắt đầu bằng 0."),
  ownerName: z.string().trim().min(2, "Tên chủ ví tối thiểu 2 ký tự.").max(100),
  qrUrl: z
    .string()
    .trim()
    .max(500, "Link ảnh QR quá dài.")
    .refine((v) => v === "" || v.startsWith("https://"), "Link ảnh QR phải bắt đầu bằng https://")
    .optional()
    .nullable(),
  note: z.string().trim().max(200, "Ghi chú tối đa 200 ký tự.").optional().nullable(),
});
