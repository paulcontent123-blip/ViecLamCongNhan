import type { Metadata } from "next";
import Link from "next/link";
import { getHealthProviderSession } from "@/lib/health-provider-auth";
import { HealthRegisterForm } from "@/components/doitac/HealthAuthForms";
import { PORTALS } from "@/components/doitac/PortalChrome";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Đối tác y tế | ViecLamCongNhan.com",
  description:
    "Phòng khám, bệnh viện và trung tâm y tế đăng dịch vụ, nhận yêu cầu liên hệ và đặt lịch từ công nhân trên ViecLamCongNhan.com.",
};

// Trang có đọc cookie phiên để đổi lời mời gọi, nên không dựng tĩnh được.
export const dynamic = "force-dynamic";

export default async function YTeDoiTacPage() {
  const session = await getHealthProviderSession();

  return (
    <div className="bg-[#f6f7f9] px-4 py-12 sm:px-8 sm:py-16 lg:px-[52px]">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_minmax(380px,480px)]">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">Đối tác y tế</div>
          <h1 className="mt-3 text-[30px] font-extrabold leading-tight text-brand-navy sm:text-[40px]">
            Đưa dịch vụ của cơ sở
            <br />
            <em className="not-italic text-brand-orange">đến đúng công nhân cần khám</em>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-brand-navy/60">
            Đăng dịch vụ khám, tư vấn và sàng lọc một lần, hiển thị cho công nhân trên cả web và app. Nhận yêu cầu
            liên hệ, đặt lịch, và mở số điện thoại của những người đã đồng ý để cơ sở liên hệ.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {PORTALS.health.nav
              .filter((item) => item.key !== "dashboard")
              .map((item) => (
                <div key={item.key} className="rounded-xl border border-black/5 bg-white p-4">
                  <div className="text-[20px]" aria-hidden="true">
                    {item.icon}
                  </div>
                  <div className="mt-2 text-[13.5px] font-extrabold text-brand-navy">{item.label}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-brand-navy/55">{item.desc}</p>
                </div>
              ))}
          </div>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-800">
            <strong className="font-extrabold">Cần Admin xác minh trước.</strong> Admin đối chiếu số giấy phép và hồ
            sơ chứng minh của cơ sở. Chỉ khi đã xác minh mới gửi được dịch vụ duyệt và mở được liên hệ; dịch vụ gửi
            lên vẫn cần Admin duyệt mới hiển thị công khai.
          </div>

          <div className="mt-3 rounded-xl border border-black/5 bg-white px-4 py-3 text-[12.5px] leading-relaxed text-brand-navy/60">
            <strong className="font-extrabold text-brand-navy">Về thông tin người bệnh:</strong> hệ thống chỉ chuyển
            cho cơ sở họ tên, số điện thoại, ngày và khung giờ mong muốn. Không thu triệu chứng, bệnh sử hay hồ sơ
            khám.
          </div>

          <p className="mt-5 text-[13px] text-brand-navy/50">
            Muốn xem công nhân đang thấy gì?{" "}
            <Link href={ROUTES.yTe} className="font-bold text-brand-orange">
              Danh sách dịch vụ y tế công khai →
            </Link>
          </p>
        </div>

        <div className="lg:sticky lg:top-[76px] lg:self-start">
          {session ? (
            <div className="rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm">
              <div className="text-[32px]">🏥</div>
              <h2 className="mt-2 text-[16px] font-extrabold text-brand-navy">Bạn đang đăng nhập</h2>
              <p className="mt-1 text-[12.5px] text-brand-navy/50">
                Vào khu quản lý để đăng dịch vụ và xem yêu cầu liên hệ.
              </p>
              <Link
                href={ROUTES.yTeDoiTacDashboard}
                className="mt-5 inline-block rounded-xl bg-brand-orange px-6 py-2.5 text-[13px] font-bold text-white transition hover:brightness-110"
              >
                Vào khu quản lý →
              </Link>
            </div>
          ) : (
            <HealthRegisterForm />
          )}
        </div>
      </div>
    </div>
  );
}
