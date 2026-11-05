// Khung chung cho mọi trang trong các cổng tự phục vụ của đối tác (Đơn vị đào tạo, Cơ sở y tế…):
// thanh trên, menu bên và vùng nội dung.
//
// Không có hook nên dùng được từ trang máy chủ; trang nào đang mở thì truyền `active` vào, không dò pathname.
// Mỗi cổng chỉ khác nhau ở danh sách menu và màu thương hiệu, nên khai báo ở `PORTALS` thay vì chép khung.
// Lớp Tailwind phải là chuỗi nguyên văn (Tailwind quét mã nguồn), nên màu của từng cổng ghi sẵn đủ lớp cần dùng.

import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { PortalLogoutButton } from "@/components/doitac/PortalLogoutButton";

export type PortalKey = "training" | "health" | "insurance" | "finance" | "rental";

/** Trang đang mở trong cổng; mỗi cổng có bộ khoá riêng (xem `PORTALS[...].nav`). */
export type PortalPage = string;

export type PortalNavItem = { key: PortalPage; href: string; icon: string; label: string; desc: string };

type PortalConfig = {
  /** Chữ nhỏ cạnh logo trên thanh trên cùng. */
  name: string;
  /** Nền thanh trên cùng. */
  bar: string;
  /** Mục menu đang mở. */
  activeNav: string;
  nav: PortalNavItem[];
};

export const PORTALS: Record<PortalKey, PortalConfig> = {
  training: {
    name: "Đối tác học nghề",
    bar: "bg-brand-orange-2",
    activeNav: "bg-brand-orange-light text-brand-orange",
    nav: [
      { key: "dashboard", href: ROUTES.hocNgheDoiTacDashboard, icon: "📊", label: "Tổng quan", desc: "Số liệu và hoạt động gần đây" },
      { key: "courses", href: ROUTES.hocNgheDoiTacCourses, icon: "🎓", label: "Khóa học của tôi", desc: "Tạo khóa học và theo dõi trạng thái duyệt" },
      { key: "applications", href: ROUTES.hocNgheDoiTacApplications, icon: "📄", label: "Hồ sơ học viên", desc: "Cập nhật trạng thái và mở liên hệ theo hạn mức" },
      { key: "inquiries", href: ROUTES.hocNgheDoiTacInquiries, icon: "📨", label: "Yêu cầu học nghề", desc: "Quản lý yêu cầu tư vấn và ghi danh" },
      { key: "learners", href: ROUTES.hocNgheDoiTacLearners, icon: "🔎", label: "Kho học viên", desc: "Hồ sơ đã đồng ý chia sẻ, mở liên hệ theo hạn mức" },
      { key: "profile", href: ROUTES.hocNgheDoiTacProfile, icon: "🏫", label: "Thông tin đơn vị", desc: "Cập nhật hồ sơ và logo" },
      { key: "orders", href: ROUTES.hocNgheDoiTacOrders, icon: "💳", label: "Gói & đơn hàng", desc: "Basic/Premium, tạo đơn và theo dõi đối soát" },
    ],
  },
  health: {
    name: "Đối tác y tế",
    bar: "bg-brand-orange-2",
    activeNav: "bg-brand-orange-light text-brand-orange",
    nav: [
      { key: "dashboard", href: ROUTES.yTeDoiTacDashboard, icon: "📊", label: "Tổng quan", desc: "Số liệu và hoạt động gần đây" },
      { key: "services", href: ROUTES.yTeDoiTacServices, icon: "🩺", label: "Dịch vụ của tôi", desc: "Tạo, sửa và theo dõi duyệt dịch vụ" },
      { key: "inquiries", href: ROUTES.yTeDoiTacInquiries, icon: "📨", label: "Yêu cầu liên hệ", desc: "Theo dõi, cập nhật trạng thái và mở liên hệ" },
      { key: "profile", href: ROUTES.yTeDoiTacProfile, icon: "🏥", label: "Hồ sơ cơ sở", desc: "Thông tin pháp lý, liên hệ và logo" },
      { key: "booked", href: ROUTES.yTeDoiTacBooked, icon: "📦", label: "Dịch vụ đã đặt", desc: "Yêu cầu tư vấn dịch vụ, quảng cáo đã gửi" },
    ],
  },
  insurance: {
    name: "Đối tác bảo hiểm",
    bar: "bg-brand-orange-2",
    activeNav: "bg-brand-orange-light text-brand-orange",
    nav: [
      { key: "dashboard", href: ROUTES.baoHiemDoiTacDashboard, icon: "📊", label: "Tổng quan", desc: "Số liệu và hoạt động gần đây" },
      { key: "products", href: ROUTES.baoHiemDoiTacProducts, icon: "🛡️", label: "Sản phẩm của tôi", desc: "Tạo, sửa và theo dõi sản phẩm đã gửi duyệt" },
      { key: "inquiries", href: ROUTES.baoHiemDoiTacInquiries, icon: "📨", label: "Yêu cầu tư vấn", desc: "Xử lý yêu cầu; mở liên hệ khi người gửi đã đồng ý" },
      { key: "orders", href: ROUTES.baoHiemDoiTacOrders, icon: "💳", label: "Gói & hạn mức", desc: "Basic/Premium và lượt mở liên hệ tư vấn" },
      { key: "profile", href: ROUTES.baoHiemDoiTacProfile, icon: "🏢", label: "Hồ sơ đơn vị", desc: "Thông tin pháp lý, liên hệ và logo" },
      { key: "booked", href: ROUTES.baoHiemDoiTacBooked, icon: "📦", label: "Dịch vụ đã đặt", desc: "Yêu cầu tư vấn dịch vụ, quảng cáo đã gửi" },
    ],
  },
  finance: {
    name: "Đối tác tài chính",
    bar: "bg-brand-orange-2",
    activeNav: "bg-brand-orange-light text-brand-orange",
    nav: [
      { key: "dashboard", href: ROUTES.taiChinhDoiTacDashboard, icon: "📊", label: "Tổng quan", desc: "Số liệu và hoạt động gần đây" },
      { key: "products", href: ROUTES.taiChinhDoiTacProducts, icon: "💰", label: "Sản phẩm của tôi", desc: "Tạo, sửa và theo dõi sản phẩm đã gửi duyệt" },
      { key: "inquiries", href: ROUTES.taiChinhDoiTacInquiries, icon: "📨", label: "Yêu cầu tư vấn", desc: "Xử lý yêu cầu; mở liên hệ khi người gửi đã đồng ý" },
      { key: "orders", href: ROUTES.taiChinhDoiTacOrders, icon: "💳", label: "Gói & hạn mức", desc: "Basic/Premium và lượt mở liên hệ tư vấn" },
      { key: "profile", href: ROUTES.taiChinhDoiTacProfile, icon: "🏢", label: "Hồ sơ đơn vị", desc: "Thông tin pháp lý, giấy phép, liên hệ và logo" },
      { key: "booked", href: ROUTES.taiChinhDoiTacBooked, icon: "📦", label: "Dịch vụ đã đặt", desc: "Yêu cầu tư vấn dịch vụ, quảng cáo đã gửi" },
    ],
  },
  rental: {
    name: "Đối tác thuê trọ",
    bar: "bg-brand-orange-2",
    activeNav: "bg-brand-orange-light text-brand-orange",
    nav: [
      { key: "dashboard", href: ROUTES.thueTroDoiTacDashboard, icon: "📊", label: "Tổng quan", desc: "Số liệu và hoạt động gần đây" },
      { key: "listings", href: ROUTES.thueTroDoiTacListings, icon: "🏠", label: "Tin cho thuê", desc: "Tạo, sửa, đăng ảnh và theo dõi duyệt tin" },
      { key: "inquiries", href: ROUTES.thueTroDoiTacInquiries, icon: "📨", label: "Yêu cầu thuê", desc: "Quản lý yêu cầu và mở liên hệ theo hạn mức" },
      { key: "tenants", href: ROUTES.thueTroDoiTacTenants, icon: "🔎", label: "Kho người thuê", desc: "Hồ sơ công nhân đã đồng ý chia sẻ; mở liên hệ theo hạn mức" },
      { key: "orders", href: ROUTES.thueTroDoiTacOrders, icon: "💳", label: "Gói & đơn hàng", desc: "Mua gói Basic/Premium, theo dõi thanh toán" },
      { key: "profile", href: ROUTES.thueTroDoiTacProfile, icon: "👤", label: "Hồ sơ đối tác", desc: "Cập nhật thông tin chủ trọ / đơn vị và logo" },
      { key: "booked", href: ROUTES.thueTroDoiTacBooked, icon: "📦", label: "Dịch vụ đã đặt", desc: "Yêu cầu tư vấn dịch vụ, quảng cáo đã gửi" },
    ],
  },
};

/** Giữ tên cũ cho các trang của cổng Học nghề đang dùng. */
export const PORTAL_NAV = PORTALS.training.nav;

export function PortalChrome({
  portal = "training",
  active,
  providerName,
  children,
}: {
  portal?: PortalKey;
  active: PortalPage;
  providerName: string;
  children: React.ReactNode;
}) {
  const config = PORTALS[portal];

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className={`flex items-center justify-between px-4 py-3 sm:px-6 ${config.bar}`}>
        <div className="min-w-0">
          <div className="text-[14.5px] font-extrabold text-white">
            ViecLam<em className="not-italic text-brand-orange">CongNhan</em>
            <span className="ml-2 font-medium text-white/40">‑ {config.name}</span>
          </div>
          <div className="truncate text-[12px] text-white/60">{providerName}</div>
        </div>
        <PortalLogoutButton portal={portal} />
      </div>

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <nav className="border-b border-black/5 bg-white px-2 py-3 lg:min-h-[calc(100vh-62px)] lg:border-b-0 lg:border-r lg:px-0 lg:py-4">
          <div className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5 lg:px-2">
            {config.nav.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={item.key === active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-[13px] font-semibold transition ${
                  item.key === active
                    ? config.activeNav
                    : "text-brand-navy/60 hover:bg-brand-navy/[0.04] hover:text-brand-navy"
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        <main className="min-w-0 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

/** Tiêu đề trang trong cổng, kèm một nút hành động tuỳ chọn ở bên phải. */
export function PortalHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[16px] font-extrabold text-brand-navy">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-[13px] text-brand-navy/50">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * Dải nhắc đơn vị chưa được xác minh; nhiều thao tác bị máy chủ chặn cho tới khi Admin xác minh.
 * Mặc định là lời nhắc của cổng Học nghề; cổng khác truyền `message` của mình.
 */
export function UnverifiedNotice({ message }: { message?: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-800">
      <strong className="font-extrabold">Đơn vị chưa được Admin xác minh.</strong>{" "}
      {message ?? (
        <>
          Chưa gửi được khóa học và chưa mở được liên hệ học viên. Sau khi xác minh, khóa học gửi lên vẫn cần Admin
          duyệt mới hiển thị công khai.
        </>
      )}
    </div>
  );
}
