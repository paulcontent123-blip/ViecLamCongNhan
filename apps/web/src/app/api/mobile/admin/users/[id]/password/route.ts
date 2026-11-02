import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { resetAccountPassword } from "@/lib/admin-account-mutations";
import { accountExpectedSchema, validAdminAccountId } from "@/lib/mobile-admin-users";

const headers = { "Cache-Control": "private, no-store" };
const bodySchema = z.object({ password: z.string().min(8).max(72), expected: accountExpectedSchema }).strict();

// Đặt mật khẩu mới cho tài khoản khác (chỉ Superadmin). Mọi phiên cũ của tài khoản đó bị thu hồi.
// Mật khẩu chỉ đi qua đây một lần, không ghi vào nhật ký và không trả lại trong phản hồi.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin("admin_users");
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!validAdminAccountId(id)) return NextResponse.json({ error: "Mã tài khoản không hợp lệ." }, { status: 400, headers });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Buffer.byteLength(parsed.data.password, "utf8") > 72) {
    return NextResponse.json({ error: "Mật khẩu cần từ 8 ký tự và không quá 72 byte." }, { status: 400, headers });
  }
  const result = await resetAccountPassword(auth.session.userId, id, parsed.data.password, parsed.data.expected);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers });
  await logAdminAction(auth.session, "user.reset_password", { type: "user", id }, { role: parsed.data.expected.role });
  return NextResponse.json({ ok: true }, { headers });
}
