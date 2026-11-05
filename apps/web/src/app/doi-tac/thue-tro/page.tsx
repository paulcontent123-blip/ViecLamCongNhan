import type { Metadata } from "next";
import { RentalRegisterForm } from "@/components/doitac/RentalPortal";
import { ProviderLanding } from "@/components/doitac/ProviderLanding";
import { getRentalProviderSession } from "@/lib/rental-provider-auth";
import { ROUTES } from "@/lib/routes";
import { WORKER_SERVICES } from "@/lib/worker-services";

export const metadata: Metadata = {
  title: "Đối tác thuê trọ | ViecLamCongNhan.com",
  description:
    "Chủ trọ đăng tin cho thuê phòng gần khu công nghiệp, nhận yêu cầu thuê và tìm người thuê phù hợp trên ViecLamCongNhan.com.",
};

// Trang có đọc cookie phiên để đổi lời mời gọi, nên không dựng tĩnh được.
export const dynamic = "force-dynamic";

export default async function ThueTroDoiTacPage() {
  const session = await getRentalProviderSession();
  const service = WORKER_SERVICES["thue-tro"];

  return (
    <ProviderLanding
      portal="rental"
      kicker="Đối tác thuê trọ"
      kickerClass="text-brand-orange"
      titleLead="Cho thuê phòng trọ"
      titleAccent="đến đúng công nhân đang tìm chỗ ở"
      accentClass="text-brand-orange"
      buttonClass="bg-brand-orange text-white"
      icon="🏠"
      intro="Đăng tin phòng trọ kèm ảnh, giá và tiện ích một lần, hiển thị trên cả web và app. Nhận yêu cầu thuê, tìm trong Kho người thuê những công nhân đã đồng ý chia sẻ, và mở số điện thoại theo hạn mức."
      notices={[
        {
          tone: "amber",
          body: (
            <>
              <strong className="font-extrabold">Cần Admin xác minh trước.</strong> Chỉ khi đã xác minh mới gửi được tin duyệt và mở được liên hệ; tin gửi lên vẫn cần Admin duyệt mới hiển thị công khai.
            </>
          ),
        },
        {
          tone: "plain",
          body: (
            <>
              <strong className="font-extrabold text-brand-navy">Về thông tin người thuê:</strong> danh sách hiện ẩn danh, số điện thoại chỉ mở từng người và mỗi lượt được tính vào hạn mức tháng của gói.
            </>
          ),
        },
      ]}
      publicHref={service.href}
      publicLabel="Danh sách phòng trọ công khai"
      loggedIn={Boolean(session)}
      dashboardHref={ROUTES.thueTroDoiTacDashboard}
      loggedInNote="Vào khu quản lý để đăng tin và xem yêu cầu thuê."
      form={<RentalRegisterForm />}
    />
  );
}
