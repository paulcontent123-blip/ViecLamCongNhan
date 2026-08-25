import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEmployerSession } from "@/lib/employer-auth";
import { estimateBlastReach } from "@/lib/employer";

const bodySchema = z.object({
  channel: z.enum(["sms", "zalo", "combo"]),
  targetProvince: z.string().optional(),
  targetIndustry: z.string().optional(),
  quantity: z.coerce.number().int().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getEmployerSession();
  if (!session) {
    return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const result = await estimateBlastReach(parsed.data);
  return NextResponse.json(result);
}
