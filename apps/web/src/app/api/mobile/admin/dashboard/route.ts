import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { adminCan } from "@/lib/admin-roles";
import { getAdminDashboardStats, getAdminSidebarCounts } from "@/lib/admin";

const headers = { "Cache-Control": "private, no-store" };

// Số liệu tổng quan cho app mobile; dùng lại đúng hàm của trang /admin để số liệu khớp web.
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
    }

    const [fullStats, counts] = await Promise.all([getAdminDashboardStats(), getAdminSidebarCounts()]);
    // Doanh thu và số đơn chờ đối soát thuộc nhóm thanh toán: Biên tập không được thấy.
    const canSeePayments = adminCan(session.adminRole, "payments");
    const { jobsByStatus, totalCandidates, totalApplications, totalEmployers, unverifiedEmployers, pendingOrdersCount } = fullStats;
    const stats = canSeePayments ? fullStats : { jobsByStatus, totalCandidates, totalApplications, totalEmployers, unverifiedEmployers };

    return NextResponse.json({
      ok: true,
      stats,
      pending: {
        pendingJobs: stats.jobsByStatus.pending,
        unverifiedEmployers: stats.unverifiedEmployers,
        ...(canSeePayments ? { pendingOrders: pendingOrdersCount } : {}),
        newQuestions: counts.newQuestions,
        newServiceInquiries: counts.newServiceInquiries,
        newKcnAdInquiries: counts.newKcnAdInquiries,
        newServicePartnerInquiries: counts.newServicePartnerInquiries,
        newAdPricingInquiries: counts.newAdPricingInquiries,
      },
    }, { headers });
  } catch (error) {
    console.error("GET /api/mobile/admin/dashboard failed:", error);
    return NextResponse.json({ error: "Không tải được dữ liệu quản trị." }, { status: 500, headers });
  }
}
