import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth";
import {
  EMPLOYER_SESSION_COOKIE,
  EMPLOYER_SESSION_MAX_AGE,
  createEmployerSessionToken,
} from "@/lib/employer-session";

const bodySchema = z.object({
  // Form đăng ký rút gọn (modal, khớp bản HTML gốc) không hỏi tên người liên hệ ‑
  // mặc định dùng tên công ty. Trang /tuyen-dung (đăng ký đầy đủ) vẫn gửi kèm.
  fullName: z.string().min(2).optional(),
  companyName: z.string().min(2, "Vui lòng nhập tên công ty"),
  contactPhone: z.string().min(9, "Số điện thoại không hợp lệ"),
  email: z.string().email("Email đăng nhập không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  provinceCode: z.string().optional(),
  // Không còn ràng buộc enum ‑ employers.industry đã bỏ CHECK constraint (xem
  // migration 20260820110001), NTD có thể tự gõ "Ngành nghề khác".
  industry: z.string().min(1).optional(),
  taxCode: z.string().optional(),
});

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }
  const { fullName, companyName, contactPhone, password, provinceCode, industry, taxCode } =
    parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  const supabase = createSupabaseAdminClient();

  const passwordHash = await hashPassword(password);

  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({
      full_name: fullName || companyName,
      phone: contactPhone,
      email,
      password_hash: passwordHash,
      role: "employer",
      status: "active",
    })
    .select("id")
    .single();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Email hoặc số điện thoại đã được đăng ký. Vui lòng đăng nhập." },
      { status: 409 },
    );
  }

  const baseSlug = slugify(companyName) || "cong-ty";
  const companySlug = `${baseSlug}-${user.id.slice(0, 8)}`;

  const { data: employer, error: employerError } = await supabase
    .from("employers")
    .insert({
      user_id: user.id,
      company_name: companyName,
      company_slug: companySlug,
      contact_phone: contactPhone,
      province_code: provinceCode || null,
      industry: industry ?? null,
      tax_code: taxCode || null,
    })
    .select("id, company_name, company_slug")
    .single();

  if (employerError || !employer) {
    // Dọn user vừa tạo để không để lại tài khoản mồ côi không có employer.
    await supabase.from("users").delete().eq("id", user.id);
    return NextResponse.json({ error: "Không tạo được hồ sơ nhà tuyển dụng." }, { status: 500 });
  }

  const token = await createEmployerSessionToken({
    userId: user.id,
    employerId: employer.id,
    email,
    companyName: employer.company_name,
  });

  const response = NextResponse.json({ ok: true, employer });
  response.cookies.set(EMPLOYER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: EMPLOYER_SESSION_MAX_AGE,
  });

  return response;
}
