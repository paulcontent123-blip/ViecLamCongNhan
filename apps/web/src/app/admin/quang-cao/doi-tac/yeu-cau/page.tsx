import Link from "next/link";
import {
  ADMIN_SERVICE_INQUIRY_PAGE_SIZE,
  getAdminServiceInquiries,
  isServiceInquiryStatus,
  type AdminServiceInquiryStatus,
} from "@/lib/admin";
import { ROUTES } from "@/lib/routes";
import { buildQuery } from "@/lib/url";
import { SERVICE_INQUIRY_TYPE_SERVICE_PARTNER } from "@/lib/service-inquiry";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { ServicePartnerAdminNav } from "@/components/admin/ServicePartnerAdminNav";
import { ServiceInquiryStatusButton } from "@/components/admin/ServiceInquiryStatusButton";
import { ServiceInquiryDetailButton } from "@/components/admin/ServiceInquiryDetailButton";

function toSp(searchParams: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(searchParams)) out[key] = Array.isArray(value) ? value[0] : value;
  return out;
}

export default async function AdminServicePartnerInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = toSp(await searchParams);
  const currentPage = Math.max(1, sp.page ? Number(sp.page) || 1 : 1);
  const status: AdminServiceInquiryStatus | undefined = sp.status && isServiceInquiryStatus(sp.status) ? sp.status : undefined;
  const { inquiries, total, newCount } = await getAdminServiceInquiries({
    q: sp.q,
    status,
    type: SERVICE_INQUIRY_TYPE_SERVICE_PARTNER,
    limit: ADMIN_SERVICE_INQUIRY_PAGE_SIZE,
    offset: (currentPage - 1) * ADMIN_SERVICE_INQUIRY_PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_SERVICE_INQUIRY_PAGE_SIZE));
  const tabs: { key: AdminServiceInquiryStatus | undefined; label: string }[] = [
    { key: undefined, label: "Tất cả" },
    { key: "new", label: "Chưa tư vấn" },
    { key: "consulted", label: "Đã tư vấn" },
    { key: "cancelled", label: "Đã hủy đăng ký" },
  ];

  return (
    <div>
      <ServicePartnerAdminNav active="inquiries" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[16px] font-extrabold text-brand-navy">🤝 Đối tác dịch vụ</h1>
          <p className="mt-1 text-[12.5px] text-brand-navy/50">
            Thông tin doanh nghiệp gửi từ trang Đối tác dịch vụ · {total.toLocaleString("vi-VN")} yêu cầu
            {newCount > 0 ? ` · ${newCount} chưa tư vấn` : ""}
          </p>
        </div>
        <form action={ROUTES.adminServicePartnerInquiries} method="get" className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Tìm đối tác, công ty, SĐT..."
            className="w-60 rounded-lg border border-black/10 px-3 py-2 text-[12.5px] text-brand-navy outline-none focus:border-brand-orange"
          />
          <button type="submit" className="rounded-lg bg-brand-orange px-3.5 py-2 text-[12.5px] font-bold text-white transition hover:brightness-105">
            Tìm
          </button>
        </form>
      </div>

      <div className="mb-4 rounded-xl border border-brand-orange/15 bg-gradient-to-br from-brand-orange-light to-transparent px-4 py-3 text-[12.5px] text-brand-navy/60">
        🔒 Đây là thông tin liên hệ do doanh nghiệp chủ động gửi để đề xuất hợp tác. Chỉ Admin được xem đầy đủ và chịu trách nhiệm liên hệ lại.
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab.key === status;
          return (
            <Link
              key={tab.label}
              href={`${ROUTES.adminServicePartnerInquiries}${buildQuery(sp, { status: tab.key })}`}
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${active ? "bg-brand-orange text-white" : "bg-white text-brand-navy/60 hover:bg-black/5"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {inquiries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
          Chưa có yêu cầu đề xuất hợp tác nào phù hợp.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
          <table className="w-full min-w-[980px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/5 text-[11px] uppercase tracking-wide text-brand-navy/40">
                <th className="px-4 py-3 font-semibold">Thời gian</th>
                <th className="px-4 py-3 font-semibold">Đối tác</th>
                <th className="px-4 py-3 font-semibold">Doanh nghiệp</th>
                <th className="px-4 py-3 font-semibold">Liên hệ</th>
                <th className="px-4 py-3 font-semibold">Yêu cầu</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((inquiry) => (
                <tr key={inquiry.id} className="border-t border-black/5 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-[11.5px] text-brand-navy/50">{new Date(inquiry.created_at).toLocaleString("vi-VN")}</td>
                  <td className="max-w-[210px] px-4 py-3 font-bold text-brand-orange">{inquiry.service_name}</td>
                  <td className="px-4 py-3 font-bold text-brand-navy">{inquiry.company_name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-brand-navy/60">
                    <div>📞 {inquiry.phone}</div>
                    <div className="mt-1">✉ {inquiry.email}</div>
                  </td>
                  <td className="max-w-[280px] px-4 py-3 leading-relaxed text-brand-navy/60">
                    <div className="line-clamp-3 whitespace-pre-wrap">{inquiry.request}</div>
                    {inquiry.cancel_reason && <div className="mt-1 line-clamp-2 text-[11.5px] text-red-600">Lý do hủy: {inquiry.cancel_reason}</div>}
                    <ServiceInquiryDetailButton inquiry={inquiry} />
                  </td>
                  <td className="px-4 py-3"><ServiceInquiryStatusButton inquiryId={inquiry.id} currentStatus={inquiry.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2 text-right text-[11.5px] text-brand-navy/40">Hiển thị {inquiries.length}/{total.toLocaleString("vi-VN")} yêu cầu</div>
      <AdminPagination baseHref={ROUTES.adminServicePartnerInquiries} currentPage={currentPage} totalPages={totalPages} sp={sp} />
    </div>
  );
}
