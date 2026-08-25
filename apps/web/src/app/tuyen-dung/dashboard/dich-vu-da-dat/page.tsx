import { getEmployerSession } from "@/lib/employer-auth";
import { getEmployerServiceInquiries } from "@/lib/employer";
import { EmployerServiceInquiryList } from "@/components/ntd/EmployerServiceInquiryList";

export default async function EmployerServiceInquiriesPage() {
  const session = await getEmployerSession();
  if (!session) return null;

  const inquiries = await getEmployerServiceInquiries(session.employerId);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[15px] font-extrabold text-brand-navy">📦 Dịch vụ đã đặt</h2>
        <p className="mt-1 text-[12.5px] text-brand-navy/50">
          Các dịch vụ được đặt bằng số điện thoại của tài khoản Nhà tuyển dụng sẽ hiển thị tại đây.
        </p>
      </div>
      <EmployerServiceInquiryList inquiries={inquiries} />
    </div>
  );
}
