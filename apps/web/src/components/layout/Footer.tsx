import Link from "next/link";

import { ROUTES } from "@/lib/routes";

const footerLinkClass =
  "text-[13px] leading-5 text-white/55 transition-colors hover:text-white";

export function Footer() {
  return (
    <footer className="mt-auto bg-[#0d1117] px-4 pb-6 pt-11 text-white sm:px-8 lg:px-[52px]">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href={ROUTES.home} className="inline-block text-[20px] font-black tracking-[-0.03em]">
              ViecLam<span className="text-brand-orange">CongNhan</span>.com
            </Link>
            <p className="mt-1.5 max-w-[280px] text-[12.5px] leading-[1.7] text-white/45">
              Nền tảng việc làm công nhân lớn nhất Việt Nam. Nền tảng tuyển dụng công nhân tại các KCN
              toàn quốc. Thành viên VEA Group.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded bg-white/10 px-2.5 py-1 text-[11px] text-white/50">
                VEA Group
              </span>
              <span className="rounded bg-white/10 px-2.5 py-1 text-[11px] text-white/50">
                VEA Law
              </span>
              <span className="rounded bg-white/10 px-2.5 py-1 text-[11px] text-white/50">
                DichVuThue.net
              </span>
            </div>
          </div>

          <div>
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">Tìm việc</div>
            <div className="flex flex-col gap-2">
              <Link href={`${ROUTES.timViecLam}?tab=jobs`} className={footerLinkClass}>
                Tất cả tin tuyển dụng
              </Link>
              <Link href={`${ROUTES.timViecLam}?tab=kcn`} className={footerLinkClass}>
                KCN toàn quốc
              </Link>
              <Link href={ROUTES.ungVien} className={footerLinkClass}>
                Để lại thông tin
              </Link>
              <Link href={`${ROUTES.timViecLam}?tab=jobs`} className={footerLinkClass}>
                Việc làm theo ngành
              </Link>
              <Link href={`${ROUTES.timViecLam}?tab=jobs`} className={footerLinkClass}>
                Việc làm theo tỉnh
              </Link>
            </div>
          </div>

          <div>
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">Doanh nghiệp</div>
            <div className="flex flex-col gap-2">
              <Link href={`${ROUTES.tuyenDung}?tab=dang`} className={footerLinkClass}>
                Đăng tin tuyển dụng
              </Link>
              <Link href={ROUTES.dichVuTronGoi} className={footerLinkClass}>
                Dịch vụ trọn gói
              </Link>
              <Link href={ROUTES.dichVuTronGoi} className={footerLinkClass}>
                Tuyển dụng theo yêu cầu
              </Link>
              <Link href={`${ROUTES.tuyenDung}?tab=goi`} className={footerLinkClass}>
                Bảng giá đăng tin
              </Link>
              <Link href={ROUTES.quangCaoHopTac} className={footerLinkClass}>
                Liên hệ hợp tác
              </Link>
            </div>
          </div>

          <div>
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">Hỗ trợ</div>
            <div className="flex flex-col gap-2">
              <Link href={ROUTES.quyenLoi} className={footerLinkClass}>
                Quyền lợi người lao động
              </Link>
              <Link href={ROUTES.tinTucQuyenLoi} className={footerLinkClass}>
                Lịch nghỉ lễ 2026
              </Link>
              <Link href={`${ROUTES.tinTucQuyenLoi}/muc-luong-toi-thieu-vung-2026`} className={footerLinkClass}>
                Lương tối thiểu vùng
              </Link>
              <Link href={ROUTES.hoiDap} className={footerLinkClass}>
                Tư vấn pháp lý · VEA Law
              </Link>
              <a href="tel:18006888" className={footerLinkClass}>
                Hotline: 0767977415
              </a>
            </div>
          </div>
        </div>

        <div className="mb-[18px] h-px bg-white/10" />

        <div className="flex flex-col justify-between gap-2 text-[12px] text-white/40 sm:flex-row sm:items-center">
          <span>© 2026 ViecLamCongNhan.com · Thành viên VEA Group</span>
          <span>
            Powered by <a href="https://veagroup.global" className="text-brand-orange hover:underline">VEA Group</a> · veagroup.global
          </span>
        </div>
      </div>
    </footer>
  );
}
