import { NextResponse } from "next/server";
import { getEmployerSession } from "@/lib/employer-auth";
import { getEmployerCampaignById } from "@/lib/employer";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getEmployerSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
    const { id } = await params;
    const campaign = await getEmployerCampaignById(session.employerId, id);
    if (!campaign) return NextResponse.json({ error: "Không tìm thấy chiến dịch thuộc tài khoản này." }, { status: 404, headers });
    return NextResponse.json({ ok: true, campaign }, { headers });
  } catch (error) {
    console.error("GET /api/mobile/employer/campaigns/[id] failed:", error);
    return NextResponse.json({ error: "Không tải được thông tin chiến dịch." }, { status: 500, headers });
  }
}
