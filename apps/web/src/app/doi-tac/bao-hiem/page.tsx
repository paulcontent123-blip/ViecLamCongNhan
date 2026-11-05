import type { Metadata } from "next";
import { InsuranceRegisterForm } from "@/components/doitac/InsurancePortal";
import { ProviderLanding } from "@/components/doitac/ProviderLanding";
import { getInsuranceProviderSession } from "@/lib/insurance-provider-auth";
import { ROUTES } from "@/lib/routes";
import { WORKER_SERVICES } from "@/lib/worker-services";

export const metadata: Metadata = {
  title: "Đối tác bảo hiểm | ViecLamCongNhan.com",
  description:
    "Doanh nghiệp bảo hiểm, đại lý được ủy quyền và chương trình công đăng sản phẩm, nhận yêu cầu tư vấn từ công nhân trên ViecLamCongNhan.com.",
};

// Trang có đọc cookie phiên để đổi lời mời gọi, nên không dựng tĩnh được.
export const dynamic = "force-dynamic";

export default async function BaoHiemDoiTacPage() {
  const session = await getInsuranceProviderSession();
  const service = WORKER_SERVICES["bao-hiem"];

  return (
    <ProviderLanding
      portal="insurance"
      kicker="Đối tác bảo hiểm"
      kickerClass="text-brand-orange"
      titleLead="Giới thiệu sản phẩm bảo hiểm"
      titleAccent="đến đúng công nhân cần tư vấn"
      accentClass="text-brand-orange"
      buttonClass="bg-brand-orange text-white"
      icon="🛡️"
      intro="Đăng sản phẩm BHXH tự nguyện, BHYT, tai nạn hoặc sức khỏe một lần, hiển thị trên cả web và app. Nhận yêu cầu tư vấn từ công nhân và mở số điện thoại của những người đã đồng ý để liên hệ."
      notices={[
        {
          tone: "amber",
          body: (
            <>
              <strong className="font-extrabold">Cần Admin xác minh trước.</strong> Admin đối chiếu số giấy phép của đơn vị. Chỉ khi đã xác minh mới gửi được sản phẩm duyệt và mở được liên hệ; sản phẩm gửi lên vẫn cần Admin duyệt mới hiển thị công khai.
            </>
          ),
        },
        {
          tone: "plain",
          body: (
            <>
              <strong className="font-extrabold text-brand-navy">Chỉ giới thiệu và tư vấn.</strong> Nền tảng không bán hay phát hành hợp đồng bảo hiểm; mỗi lượt mở liên hệ được tính vào hạn mức tháng của gói.
            </>
          ),
        },
      ]}
      publicHref={service.href}
      publicLabel="Danh sách bảo hiểm công khai"
      loggedIn={Boolean(session)}
      dashboardHref={ROUTES.baoHiemDoiTacDashboard}
      loggedInNote="Vào khu quản lý để đăng sản phẩm và xem yêu cầu tư vấn."
      form={<InsuranceRegisterForm />}
    />
  );
}
