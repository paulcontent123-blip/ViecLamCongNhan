import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
const schema = z.object({ status: z.enum(["approved", "rejected", "hidden"]), rejectionReason: z.string().trim().max(500).optional() });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.status === "rejected" && !parsed.data.rejectionReason)) return NextResponse.json({ error: "Khi từ chối cần ghi lý do." }, { status: 400 });
  const { data, error } = await createSupabaseAdminClient().from("vocational_courses").update({ status: parsed.data.status, rejection_reason: parsed.data.status === "rejected" ? parsed.data.rejectionReason : null, published_at: parsed.data.status === "approved" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", id).select("id,title,status,rejection_reason").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Chưa cập nhật được trạng thái khóa học." }, { status: 500 });
  return NextResponse.json({ ok: true, course: data });
}
