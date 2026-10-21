import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const schema = z.object({
  listingId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(9).max(20).refine((value) => value.replace(/\D/g, "").length >= 9, "Số điện thoại không hợp lệ."),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional(),
  contactConsent: z.literal(true),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Thông tin yêu cầu chưa hợp lệ." }, { status: 400 });
  const input = parsed.data;
  const supabase = createSupabaseAdminClient();
  const { data: listing, error: listingError } = await supabase.from("rental_listings")
    .select("id,provider_id,status,rental_providers!inner(is_verified)").eq("id", input.listingId).maybeSingle();
  if (listingError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rentals/inquiries", operation: "load_listing_before_inquiry", error: listingError });
    return NextResponse.json({ error: "Chưa xác minh được tin cho thuê.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  const provider = Array.isArray(listing?.rental_providers) ? listing.rental_providers[0] : listing?.rental_providers;
  if (!listing || listing.status !== "approved" || !provider?.is_verified) return NextResponse.json({ error: "Tin cho thuê không còn nhận yêu cầu." }, { status: 409 });
  const { data, error } = await supabase.from("rental_inquiries").insert({
    listing_id: listing.id, provider_id: listing.provider_id, full_name: input.fullName,
    phone: input.phone, email: input.email || null, message: input.message || null, contact_consent: true,
  }).select("id,listing_id,status,created_at").single();
  if (error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/rentals/inquiries", operation: "create_rental_inquiry", error });
    return NextResponse.json({ error: "Chưa gửi được yêu cầu thuê trọ.", requestId }, { status: 503, headers: { "X-Request-Id": requestId } });
  }
  return NextResponse.json({ ok: true, inquiry: data }, { status: 201 });
}
