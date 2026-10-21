import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { ACCOUNT_TIERS, PAID_ACCOUNT_TIERS } from "@/lib/account-tiers";
import { isSelectablePaymentMethod } from "@/lib/payment-method";
import { ORDER_PAYMENT_COLUMNS, preparePaymentForOrder, toOrderPaymentView, type OrderRow } from "@/lib/payment-orders";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };
const createOrderSchema = z.object({
  tier: z.enum(PAID_ACCOUNT_TIERS),
  paymentMethod: z.string().refine(isSelectablePaymentMethod, "Phương thức thanh toán không hợp lệ."),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getTrainingProviderSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

    const { page, pageSize, offset } = parseEmployerListParams(request.nextUrl.searchParams, []);
    const supabase = createSupabaseAdminClient();
    const { data: provider, error: providerError } = await supabase.from("training_providers")
      .select("is_verified,account_type,account_tier_expires_at")
      .eq("id", session.providerId).maybeSingle();
    if (providerError) throw providerError;
    if (!provider) return NextResponse.json({ error: "Không tìm thấy đơn vị đào tạo." }, { status: 404, headers });

    const expired = provider.account_type !== "free" && provider.account_tier_expires_at && new Date(provider.account_tier_expires_at) <= new Date();
    const tier = expired ? "free" : provider.account_type;
    if (expired) {
      const { error } = await supabase.from("training_providers")
        .update({ account_type: "free", account_tier_expires_at: null })
        .eq("id", session.providerId).eq("account_type", provider.account_type);
      if (error) throw error;
    }

    const { data, error, count } = await supabase.from("orders")
      .select("id,order_type,tier,amount,payment_method,status,created_at,paid_at,code,customer_confirmed_at,reject_reason", { count: "exact" })
      .eq("training_provider_id", session.providerId)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const total = count ?? 0;
    const plans = PAID_ACCOUNT_TIERS.map((key) => ({
      key,
      label: ACCOUNT_TIERS[key].label,
      priceVnd: ACCOUNT_TIERS[key].priceVnd,
      billingCycleDays: ACCOUNT_TIERS[key].billingCycleDays,
      learnerContactLimit: ACCOUNT_TIERS[key].candidateViewLimit,
    }));
    return NextResponse.json({
      ok: true,
      items: data ?? [], page, pageSize, total, hasMore: offset + (data?.length ?? 0) < total,
      account: {
        tier, label: ACCOUNT_TIERS[tier as keyof typeof ACCOUNT_TIERS]?.label ?? "Free",
        expiresAt: expired ? null : provider.account_tier_expires_at,
        verified: provider.is_verified,
      },
      plans,
    }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("GET /api/mobile/training-provider/orders failed:", error);
    return NextResponse.json({ error: "Không tải được gói và đơn hàng." }, { status: 500, headers });
  }
}

export async function POST(request: NextRequest) {
  const session = await getTrainingProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });

  const parsed = createOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400, headers });

  const supabase = createSupabaseAdminClient();
  const { data: provider, error: providerError } = await supabase.from("training_providers")
    .select("is_verified").eq("id", session.providerId).maybeSingle();
  if (providerError) return NextResponse.json({ error: "Chưa kiểm tra được trạng thái xác minh." }, { status: 500, headers });
  if (!provider?.is_verified) return NextResponse.json({ error: "Đơn vị cần được Admin xác minh trước khi mua gói." }, { status: 403, headers });

  const { tier, paymentMethod } = parsed.data;
  const payment = await preparePaymentForOrder(paymentMethod as "bank_transfer" | "momo");
  if ("error" in payment) return NextResponse.json({ error: payment.error }, { status: 503, headers });

  const { data: created, error } = await supabase.from("orders").insert({
    employer_id: null,
    training_provider_id: session.providerId,
    order_type: "account_subscription",
    tier,
    amount: ACCOUNT_TIERS[tier].priceVnd,
    payment_method: paymentMethod,
    status: "pending",
    code: payment.code,
    payment_account_id: payment.destination.paymentAccountId,
    momo_wallet_id: payment.destination.momoWalletId,
  }).select(ORDER_PAYMENT_COLUMNS).maybeSingle();
  if (error || !created) {
    console.error("POST /api/mobile/training-provider/orders failed:", error);
    return NextResponse.json({ error: "Chưa xác định được đơn đã tạo hay chưa. Tải lại danh sách đơn trước khi thử lại." }, { status: 503, headers });
  }

  return NextResponse.json({
    ok: true,
    order: { id: created.id, order_type: created.order_type, tier: created.tier, amount: created.amount, status: created.status },
    payment: await toOrderPaymentView(created as OrderRow),
  }, { headers });
}
