import { listMomoWallets, listPaymentAccounts } from "@/lib/admin-payment";
import { PaymentChannels } from "@/components/admin/PaymentChannels";

// Danh sách đổi ngay sau mỗi thao tác bật/tắt/xoá.
export const dynamic = "force-dynamic";

export default async function AdminPaymentChannelsPage() {
  const [accounts, wallets] = await Promise.all([listPaymentAccounts(), listMomoWallets()]);

  return (
    <div>
      <h1 className="mb-1 text-[16px] font-extrabold text-brand-navy">💰 Kênh nhận tiền</h1>
      <p className="mb-4 text-[13px] text-brand-navy/50">
        Thông tin hiển thị ở màn hình thanh toán của nhà tuyển dụng. NTD chuyển tiền kèm mã đơn, tự bấm
        «Tôi đã thanh toán», rồi Admin đối soát ở mục Đơn hàng / Thanh toán.
      </p>
      <PaymentChannels accounts={accounts} wallets={wallets} />
    </div>
  );
}
