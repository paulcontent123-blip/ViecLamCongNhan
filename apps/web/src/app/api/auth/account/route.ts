import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidate-auth";
import { getFinanceProviderSession } from "@/lib/finance-provider-auth";
import { getHealthProviderSession } from "@/lib/health-provider-auth";
import { getInsuranceProviderSession } from "@/lib/insurance-provider-auth";
import { getRentalProviderSession } from "@/lib/rental-provider-auth";
import { ROUTES } from "@/lib/routes";
import { getTrainingProviderSession } from "@/lib/training-provider-auth";

// Route MỚI: cho thanh menu biết có phiên Công nhân hoặc Đối tác đang đăng nhập không, để hiện nút "Tài khoản" và trỏ đúng
// trang. Phiên Admin và Nhà tuyển dụng vẫn do `api/auth/admin/me` và `api/auth/employer/me` báo như cũ.
// Công nhân chưa được Admin xác nhận không tính là đã đăng nhập (giống việc web chặn trang tài khoản của họ).
export async function GET() {
  const [candidate, training, health, insurance, finance, rental] = await Promise.all([
    getCandidateSession().catch(() => null),
    getTrainingProviderSession().catch(() => null),
    getHealthProviderSession().catch(() => null),
    getInsuranceProviderSession().catch(() => null),
    getFinanceProviderSession().catch(() => null),
    getRentalProviderSession().catch(() => null),
  ]);

  const found: { role: string; href: string } | null = candidate
    ? { role: "candidate", href: ROUTES.congNhanAccount }
    : training
      ? { role: "training", href: ROUTES.hocNgheDoiTacDashboard }
      : health
        ? { role: "health", href: ROUTES.yTeDoiTacDashboard }
        : insurance
          ? { role: "insurance", href: ROUTES.baoHiemDoiTacDashboard }
          : finance
            ? { role: "finance", href: ROUTES.taiChinhDoiTacDashboard }
            : rental
              ? { role: "rental", href: ROUTES.thueTroDoiTacDashboard }
              : null;

  return NextResponse.json(found ? { loggedIn: true, ...found } : { loggedIn: false }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
