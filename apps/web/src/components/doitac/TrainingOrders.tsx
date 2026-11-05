"use client";

import { PORTAL_ACCENT } from "@/lib/portal-accent";
import { ProviderOrders } from "@/components/doitac/ProviderOrders";
import {
  createOrder,
  getOrderPayment,
  getPaymentMethods,
  listOrders,
  setOrderConfirmed,
} from "@/lib/training-provider-client";
import { ROUTES } from "@/lib/routes";

// Các hàm của cổng Học nghề có cùng chữ ký với `ProviderOrdersApi`, nên truyền thẳng vào component dùng chung.
const api = { listOrders, getPaymentMethods, createOrder, getOrderPayment, setOrderConfirmed };

export function TrainingOrders() {
  return (
    <ProviderOrders
      api={api}
      loginHref={ROUTES.hocNgheDoiTacLogin}
      accent={PORTAL_ACCENT}
      title="💳 Gói & đơn hàng"
      description="Gói quyết định số lượt mở liên hệ học viên mỗi tháng. Đơn tạo xong chờ Admin đối soát rồi mới kích hoạt."
      limitKey="learnerContactLimit"
      limitText="lượt mở liên hệ học viên mỗi tháng"
    />
  );
}
