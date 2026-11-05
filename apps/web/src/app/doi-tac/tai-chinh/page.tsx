import type { Metadata } from "next";
import { FinanceRegisterForm } from "@/components/doitac/FinancePortal";
import { ProviderLanding } from "@/components/doitac/ProviderLanding";
import { getFinanceProviderSession } from "@/lib/finance-provider-auth";
import { ROUTES } from "@/lib/routes";
import { WORKER_SERVICES } from "@/lib/worker-services";

export const metadata: Metadata = {
  title: "Đối tác tài chính | ViecLamCongNhan.com",
  description:
    "Tổ chức tài chính, ứng lương và chuyển tiền đăng sản phẩm, nhận yêu cầu tư vấn từ công nhân trên ViecLamCongNhan.com.",
};

// Trang có đọc cookie phiên để đổi lời mời gọi, nên không dựng tĩnh được.
export const dynamic = "force-dynamic";

export default async function TaiChinhDoiTacPage() {
  const session = await getFinanceProviderSession();
  const service = WORKER_SERVICES["tai-chinh"];

  return (
    <ProviderLanding
      portal="finance"
      kicker="Đối tác tài chính"
      kickerClass="text-brand-orange"
      titleLead="Đưa sản phẩm tài chính"
      titleAccent="đến đúng công nhân cần tư vấn"
      accentClass="text-brand-orange"
      buttonClass="bg-brand-orange text-white"
      icon="💰"
      intro="Đăng sản phẩm ứng lương trước, vay tiêu dùng hoặc chuyển tiền về quê một lần, hiển thị trên cả web và app. Nhận yêu cầu tư vấn và mở số điện thoại của những người đã đồng ý để liên hệ."
      notices={[
        {
          tone: "amber",
          body: (
            <>
              <strong className="font-extrabold">Cần giấy phép và Admin xác minh.</strong> Đơn vị cần cung cấp số giấy phép / ủy quyền và hồ sơ chứng minh. Chỉ khi đã xác minh mới gửi được sản phẩm duyệt và mở được liên hệ; sản phẩm gửi lên vẫn cần Admin duyệt mới hiển thị công khai.
            </>
          ),
        },
        {
          tone: "plain",
          body: (
            <>
              <strong className="font-extrabold text-brand-navy">Chỉ giới thiệu và tư vấn.</strong> Yêu cầu từ công nhân là đề nghị được tư vấn, chưa phải hồ sơ vay hay lệnh giao dịch; mỗi lượt mở liên hệ được tính vào hạn mức tháng của gói.
            </>
          ),
        },
      ]}
      publicHref={service.href}
      publicLabel="Danh sách tài chính công khai"
      loggedIn={Boolean(session)}
      dashboardHref={ROUTES.taiChinhDoiTacDashboard}
      loggedInNote="Vào khu quản lý để đăng sản phẩm và xem yêu cầu tư vấn."
      form={<FinanceRegisterForm />}
    />
  );
}
