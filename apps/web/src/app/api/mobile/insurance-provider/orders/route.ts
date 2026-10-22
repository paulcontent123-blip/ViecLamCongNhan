import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getInsuranceProviderSession } from "@/lib/insurance-provider-auth";
import { ACCOUNT_TIERS, PAID_ACCOUNT_TIERS } from "@/lib/account-tiers";
import { isSelectablePaymentMethod } from "@/lib/payment-method";
import { ORDER_PAYMENT_COLUMNS, preparePaymentForOrder, toOrderPaymentView, type OrderRow } from "@/lib/payment-orders";
import { parseEmployerListParams } from "@/lib/mobile-employer-list-params";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";

const headers = { "Cache-Control": "private, no-store" };
const route = "/api/mobile/insurance-provider/orders";
const createOrderSchema = z.object({
  tier: z.enum(PAID_ACCOUNT_TIERS),
  paymentMethod: z.string().refine(isSelectablePaymentMethod, "Phương thức thanh toán không hợp lệ."),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getInsuranceProviderSession();
    if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
    const { page, pageSize, offset } = parseEmployerListParams(request.nextUrl.searchParams, []);
    const supabase = createSupabaseAdminClient();
    const { data: provider, error: providerError } = await supabase.from("insurance_providers")
      .select("is_verified,account_type,account_tier_expires_at,contact_view_limit")
      .eq("id", session.providerId).maybeSingle();
    if (providerError) throw providerError;
    if (!provider) return NextResponse.json({ error: "Không tìm thấy hồ sơ đối tác Bảo hiểm." }, { status: 404, headers });

    const expired = provider.account_type !== "free" && provider.account_tier_expires_at && new Date(provider.account_tier_expires_at) <= new Date();
    const tier = expired ? "free" : provider.account_type;
    if (expired) {
      const { error } = await supabase.from("insurance_providers")
        .update({ account_type: "free", account_tier_expires_at: null })
        .eq("id", session.providerId).eq("account_type", provider.account_type);
      if (error) throw error;
    }

    const { data, error, count } = await supabase.from("orders")
      .select("id,order_type,tier,amount,payment_method,status,created_at,paid_at,code,customer_confirmed_at,reject_reason", { count: "exact" })
      .eq("insurance_provider_id", session.providerId)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;

    const plans = PAID_ACCOUNT_TIERS.map((key) => ({
      key,
      label: ACCOUNT_TIERS[key].label,
      priceVnd: ACCOUNT_TIERS[key].priceVnd,
      billingCycleDays: ACCOUNT_TIERS[key].billingCycleDays,
      inquiryContactLimit: ACCOUNT_TIERS[key].candidateViewLimit,
    }));
    const tierLimit = ACCOUNT_TIERS[tier as keyof typeof ACCOUNT_TIERS]?.candidateViewLimit ?? 0;
    return NextResponse.json({
      ok: true,
      items: data ?? [], page, pageSize, total: count ?? 0,
      hasMore: offset + (data?.length ?? 0) < (count ?? 0),
      account: {
        tier, label: ACCOUNT_TIERS[tier as keyof typeof ACCOUNT_TIERS]?.label ?? "Free",
        expiresAt: expired ? null : provider.account_tier_expires_at,
        verified: provider.is_verified,
        manualContactViewLimit: provider.contact_view_limit,
        inquiryContactLimit: provider.contact_view_limit > 0 ? provider.contact_view_limit : tierLimit,
      },
      plans,
    }, { headers });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: error.message }, { status: 400, headers });
    const requestId = logSafeSupabaseError({ route, operation: "load_orders_and_tier", error });
    return NextResponse.json({ error: "Không tải được gói và đơn hàng.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
}

export async function POST(request: NextRequest) {
  const session = await getInsuranceProviderSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
  const parsed = createOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400, headers });

  const supabase = createSupabaseAdminClient();
  const { data: provider, error: providerError } = await supabase.from("insurance_providers")
    .select("is_verified").eq("id", session.providerId).maybeSingle();
  if (providerError) {
    const requestId = logSafeSupabaseError({ route, operation: "check_provider_verification", error: providerError });
    return NextResponse.json({ error: "Chưa kiểm tra được trạng thái xác minh.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  if (!provider?.is_verified) return NextResponse.json({ error: "Đối tác cần được Admin xác minh trước khi mua gói." }, { status: 403, headers });

  const { tier, paymentMethod } = parsed.data;
  const payment = await preparePaymentForOrder(paymentMethod as "bank_transfer" | "momo");
  if ("error" in payment) return NextResponse.json({ error: payment.error }, { status: 503, headers });
  const { data: created, error } = await supabase.from("orders").insert({
    employer_id: null,
    insurance_provider_id: session.providerId,
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
    const requestId = error ? logSafeSupabaseError({ route, operation: "create_order", error }) : undefined;
    return NextResponse.json({ error: "Chưa xác định được đơn đã tạo hay chưa. Tải lại danh sách đơn trước khi thử lại.", ...(requestId ? { requestId } : {}) }, { status: 503, headers: requestId ? { ...headers, "X-Request-Id": requestId } : headers });
  }
  return NextResponse.json({
    ok: true,
    order: { id: created.id, order_type: created.order_type, tier: created.tier, amount: created.amount, status: created.status },
    payment: { ...(await toOrderPaymentView(created as OrderRow)), title: "Gói tài khoản Đối tác Bảo hiểm" },
  }, { headers });
}
