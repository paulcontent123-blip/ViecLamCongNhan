import type { Metadata } from "next";
import Link from "next/link";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";
import { TrainingRegisterForm } from "@/components/doitac/TrainingRegisterForm";
import { PORTAL_NAV } from "@/components/doitac/PortalChrome";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Đối tác học nghề | ViecLamCongNhan.com",
  description:
    "Trung tâm và đơn vị đào tạo nghề đăng khóa học, nhận hồ sơ học viên và yêu cầu tư vấn từ công nhân trên ViecLamCongNhan.com.",
};

// Trang có đọc cookie phiên để đổi lời mời gọi, nên không dựng tĩnh được.
export const dynamic = "force-dynamic";

export default async function HocNgheDoiTacPage() {
  const session = await getTrainingProviderSession();

  return (
    <div className="bg-[#f6f7f9] px-4 py-12 sm:px-8 sm:py-16 lg:px-[52px]">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_minmax(380px,460px)]">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">Đối tác học nghề</div>
          <h1 className="mt-3 text-[30px] font-extrabold leading-tight text-brand-navy sm:text-[40px]">
            Dạy nghề cho công nhân,
            <br />
            <em className="not-italic text-brand-orange">tuyển học viên ngay trong app</em>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-brand-navy/60">
            Đăng khóa học một lần, hiển thị cho công nhân trên cả web và app. Nhận hồ sơ học viên, yêu cầu tư
            vấn, và mở liên hệ của những người đã đồng ý chia sẻ thông tin.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {PORTAL_NAV.filter((item) => item.key !== "dashboard").map((item) => (
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
            <strong className="font-extrabold">Cần Admin xác minh trước.</strong> Sau khi đăng ký, Admin đối chiếu
            thông tin đơn vị. Chỉ khi đã xác minh, đơn vị mới gửi được khóa học và mở được liên hệ học viên; khóa
            học gửi lên vẫn cần Admin duyệt mới hiển thị công khai.
          </div>

          <p className="mt-5 text-[13px] text-brand-navy/50">
            Muốn xem công nhân đang thấy gì?{" "}
            <Link href={ROUTES.hocNghe} className="font-bold text-brand-orange">
              Danh sách khóa học công khai →
            </Link>
          </p>
        </div>

        <div className="lg:sticky lg:top-[76px] lg:self-start">
          {session ? (
            <div className="rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm">
              <div className="text-[32px]">🎓</div>
              <h2 className="mt-2 text-[16px] font-extrabold text-brand-navy">Bạn đang đăng nhập</h2>
              <p className="mt-1 text-[12.5px] text-brand-navy/50">
                Vào khu quản lý để đăng khóa học và xem hồ sơ học viên.
              </p>
              <Link
                href={ROUTES.hocNgheDoiTacDashboard}
                className="mt-5 inline-block rounded-xl bg-brand-orange px-6 py-2.5 text-[13px] font-bold text-white transition hover:brightness-110"
              >
                Vào khu quản lý →
              </Link>
            </div>
          ) : (
            <TrainingRegisterForm />
          )}
        </div>
      </div>
    </div>
  );
}
