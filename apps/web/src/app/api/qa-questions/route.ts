import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  question: z.string().trim().min(10, "Câu hỏi tối thiểu 10 ký tự"),
  fullName: z.string().trim().optional().or(z.literal("")),
  contact: z.string().trim().min(6, "Vui lòng nhập SĐT hoặc email để VEA Law liên hệ lại"),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("qa_questions").insert({
    question: parsed.data.question,
    full_name: parsed.data.fullName || null,
    contact: parsed.data.contact,
    status: "new",
  });

  if (error) {
    return NextResponse.json({ error: "Không gửi được câu hỏi, thử lại sau." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
