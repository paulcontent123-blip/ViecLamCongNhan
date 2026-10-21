import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRentalProviderSession } from "@/lib/rental-provider-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { isRentalProviderUnverifiedError, rentalListingPatchRow, rentalListingSchema } from "@/lib/rental-provider-listing-utils";

const patchSchema = z.object({
  ...rentalListingSchema.partial().shape,
  action: z.enum(["draft", "submit"]).optional(),
  status: z.enum(["hidden", "full"]).optional(),
}).refine((value) => Object.keys(value).length > 0, "Không có nội dung cần cập nhật.");

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getRentalProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin cập nhật không hợp lệ." }, { status: 400 });
  const input = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data: current, error: currentError } = await supabase.from("rental_listings")
    .select("id,status").eq("id", id).eq("provider_id", session.providerId).maybeSingle();
  if (currentError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/listings/[id]", operation: "load_owned_rental_listing", error: currentError });
    return NextResponse.json({ error: "Chưa tải được tin cho thuê.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!current) return NextResponse.json({ error: "Không tìm thấy tin thuộc tài khoản này." }, { status: 404 });
  const updates: Record<string, unknown> = {};
  const contentKeys = ["title", "description", "monthlyRentVnd", "areaSqm", "provinceCode", "location", "roomType", "capacity", "nearbyIndustrialZone", "amenities", "photoUrls"] as const;
  const content = Object.fromEntries(contentKeys.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]));
  if (Object.keys(content).length) {
    const parsedContent = rentalListingSchema.partial().safeParse(content);
    if (!parsedContent.success) return NextResponse.json({ error: parsedContent.error.issues[0]?.message ?? "Nội dung tin không hợp lệ." }, { status: 400 });
    Object.assign(updates, rentalListingPatchRow(parsedContent.data));
  }
  if (input.status) updates.status = input.status;
  if (input.action) {
    if (input.action === "submit") {
      const { data: provider, error: providerError } = await supabase.from("rental_providers").select("is_verified").eq("id", session.providerId).maybeSingle();
      if (providerError) {
        const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/listings/[id]", operation: "check_provider_before_listing_submit", error: providerError });
        return NextResponse.json({ error: "Chưa xác minh được quyền gửi tin.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
      }
      if (!provider?.is_verified) return NextResponse.json({ error: "Đối tác cần được Admin xác minh trước khi gửi tin cho thuê." }, { status: 403 });
      updates.status = "pending";
      updates.rejection_reason = null;
    } else updates.status = "draft";
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: "Không có nội dung cần cập nhật." }, { status: 400 });
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("rental_listings").update(updates).eq("id", id)
    .eq("provider_id", session.providerId).select("id,title,status,rejection_reason,updated_at").maybeSingle();
  if (error) {
    if (isRentalProviderUnverifiedError(error)) return NextResponse.json({ error: "Đối tác cần được Admin xác minh trước khi gửi tin cho thuê." }, { status: 403 });
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rental-provider/listings/[id]", operation: "update_owned_rental_listing", error });
    return NextResponse.json({ error: "Chưa cập nhật được tin cho thuê.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  if (!data) return NextResponse.json({ error: "Không tìm thấy tin thuộc tài khoản này." }, { status: 404 });
  return NextResponse.json({ ok: true, listing: data });
}
