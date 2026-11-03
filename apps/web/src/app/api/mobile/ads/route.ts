import { NextRequest, NextResponse } from "next/server";
import { AD_PLACEMENTS, validAdId, type AdPlacement } from "@/lib/ads";
import { getRunningAds } from "@/lib/ads-queries";

// Công khai (không cần đăng nhập): quảng cáo đang chạy trên app cho một vị trí; card theo KCN cần kcnId.
// Chỉ trả phần hiển thị, không có ghi chú nội bộ hay thời hạn. Lỗi đọc trả danh sách rỗng để không làm hỏng màn hình.
export async function GET(request: NextRequest) {
  const placement = request.nextUrl.searchParams.get("placement") ?? "";
  const kcnId = request.nextUrl.searchParams.get("kcnId");
  if (!(AD_PLACEMENTS as readonly string[]).includes(placement) || placement === "sidebar") {
    return NextResponse.json({ error: "Vị trí quảng cáo không hợp lệ." }, { status: 400 });
  }
  if (kcnId !== null && !validAdId(kcnId)) return NextResponse.json({ error: "KCN không hợp lệ." }, { status: 400 });
  if (placement === "service_card" && !kcnId) return NextResponse.json({ ok: true, ads: [] }, { headers: { "Cache-Control": "public, max-age=60" } });
  const ads = await getRunningAds({ placement: placement as AdPlacement, channel: "app", kcnId });
  return NextResponse.json({ ok: true, ads }, { headers: { "Cache-Control": "public, max-age=60" } });
}
