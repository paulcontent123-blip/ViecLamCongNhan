import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { adminCan } from "@/lib/admin-roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminDashboardStats, getAdminSidebarCounts } from "@/lib/admin";

const headers = { "Cache-Control": "private, no-store" };

// Số liệu tổng quan cho app mobile; dùng lại đúng hàm của trang /admin để số liệu khớp web.
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401, headers });
    }

    const [fullStats, counts, workerInquiries] = await Promise.all([
      getAdminDashboardStats(),
      getAdminSidebarCounts(),
      createSupabaseAdminClient().from("admin_worker_inquiries").select("id", { count: "exact", head: true }).eq("routed_to", "admin").eq("admin_status", "new"),
    ]);
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
        // Bỏ qua khi chưa có migration hoặc lỗi đọc để không làm hỏng cả bảng điều khiển.
        ...(workerInquiries.error ? {} : { newWorkerInquiries: workerInquiries.count ?? 0 }),
      },
    }, { headers });
  } catch (error) {
    console.error("GET /api/mobile/admin/dashboard failed:", error);
    return NextResponse.json({ error: "Không tải được dữ liệu quản trị." }, { status: 500, headers });
  }
}
