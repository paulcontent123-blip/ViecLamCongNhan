import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const reviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  rejectionReason: z.string().trim().max(500).optional().default(""),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Vui lòng đăng nhập Admin." }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Mã tin không hợp lệ." }, { status: 400 });
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Thông tin kiểm duyệt chưa hợp lệ." }, { status: 400 });
  const input = parsed.data;
  if (input.status === "rejected" && input.rejectionReason.length < 3) return NextResponse.json({ error: "Nhập lý do từ chối ít nhất 3 ký tự." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  if (input.status === "approved") {
    const { data: listing, error: loadError } = await supabase.from("secondhand_marketplace_listings")
      .select("id,photo_urls")
      .eq("id", id).eq("moderation_status", "pending").eq("updated_at", input.expectedUpdatedAt).maybeSingle();
    if (loadError) {
      const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/marketplace/[id]", operation: "check_marketplace_photos_before_approval", error: loadError });
      return NextResponse.json({ error: "Chưa xác minh được ảnh của tin.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
    }
    if (!listing) return NextResponse.json({ error: "Tin không còn chờ duyệt hoặc đã thay đổi. Tải lại danh sách trước khi tiếp tục." }, { status: 409 });
    if (!listing.photo_urls?.length) return NextResponse.json({ error: "Tin cần có ít nhất một ảnh trước khi được duyệt công khai." }, { status: 409 });
  }
  const now = new Date();
  const timestamp = now.toISOString();
  const update = input.status === "approved"
    ? { moderation_status: "approved", rejection_reason: null, published_at: timestamp, expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), updated_at: timestamp }
    : { moderation_status: "rejected", rejection_reason: input.rejectionReason, published_at: null, expires_at: null, updated_at: timestamp };
  const { data, error } = await supabase.from("secondhand_marketplace_listings").update(update)
    .eq("id", id).eq("moderation_status", "pending").eq("updated_at", input.expectedUpdatedAt)
    .select("id,title,moderation_status,rejection_reason,published_at,expires_at,updated_at").maybeSingle();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/admin/marketplace/[id]", operation: "review_marketplace_listing", error });
    return NextResponse.json({ error: "Chưa lưu được kết quả kiểm duyệt.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Tin không còn chờ duyệt hoặc đã thay đổi. Tải lại danh sách trước khi tiếp tục." }, { status: 409 });
  return NextResponse.json({ ok: true, listing: data });
}
