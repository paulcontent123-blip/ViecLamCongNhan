import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  SERVICE_INQUIRY_TYPE_ADVERTISING,
  SERVICE_INQUIRY_TYPE_ADVERTISING_PRICING,
  SERVICE_INQUIRY_TYPE_SERVICE_PARTNER,
  SERVICE_INQUIRY_TYPE_SERVICE_PACKAGE,
} from "@/lib/service-inquiry";
import { normalizePhone } from "@/lib/phone";

const bodySchema = z.object({
  inquiryType: z.enum(["service-package", "advertising", "service-partner", "advertising-pricing"]).default("service-package"),
  serviceName: z.string().trim().min(2, "Tên dịch vụ không hợp lệ."),
  companyName: z.string().trim().min(2, "Vui lòng nhập tên công ty / nhà tuyển dụng."),
  phone: z.string().trim().min(9, "Số điện thoại không hợp lệ."),
  email: z.string().trim().email("Email không hợp lệ."),
  request: z.string().trim().min(10, "Vui lòng mô tả nhu cầu tư vấn rõ hơn."),
  kcnTarget: z.string().trim().max(200, "KCN / Tỉnh tối đa 200 ký tự.").optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  }

  if (parsed.data.inquiryType === "advertising" && !parsed.data.kcnTarget?.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập KCN / Tỉnh muốn quảng cáo." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_inquiries")
    .insert({
      type:
        parsed.data.inquiryType === "advertising"
          ? SERVICE_INQUIRY_TYPE_ADVERTISING
          : parsed.data.inquiryType === "advertising-pricing"
            ? SERVICE_INQUIRY_TYPE_ADVERTISING_PRICING
          : parsed.data.inquiryType === "service-partner"
            ? SERVICE_INQUIRY_TYPE_SERVICE_PARTNER
            : SERVICE_INQUIRY_TYPE_SERVICE_PACKAGE,
      service_name: parsed.data.serviceName,
      company_name: parsed.data.companyName,
      phone: parsed.data.phone,
      phone_normalized: normalizePhone(parsed.data.phone),
      email: parsed.data.email.toLowerCase(),
      request: parsed.data.request,
      kcn_target: parsed.data.kcnTarget?.trim() || null,
      status: "new",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Không gửi được yêu cầu, vui lòng thử lại sau." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inquiryId: data.id }, { status: 201 });
}
