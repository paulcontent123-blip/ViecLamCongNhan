import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { setPartnerActive } from "@/lib/admin";

const bodySchema = z.object({
  active: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin("partners");
  if (auth.error) return auth.error;
  const session = auth.session;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { id } = await params;
  const ok = await setPartnerActive(id, parsed.data.active);
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy đối tác." }, { status: 404 });
  }

  await logAdminAction(session, "revenue_partner.active", { type: "revenue_partner", id }, { active: parsed.data.active });
  return NextResponse.json({ ok: true });
}
