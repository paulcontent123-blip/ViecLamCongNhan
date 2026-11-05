"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { logout as logoutFinance } from "@/lib/finance-provider-client";
import { logout as logoutHealth } from "@/lib/health-provider-client";
import { logout as logoutInsurance } from "@/lib/insurance-provider-client";
import { logout as logoutRental } from "@/lib/rental-provider-client";
import { logout as logoutTraining } from "@/lib/training-provider-client";
import { ROUTES } from "@/lib/routes";

/** Mỗi cổng có API đăng xuất và trang đăng nhập riêng; chọn theo khoá cổng truyền từ khung trang. */
const PORTAL_SESSION = {
  training: { logout: logoutTraining, loginHref: ROUTES.hocNgheDoiTacLogin },
  health: { logout: logoutHealth, loginHref: ROUTES.yTeDoiTacLogin },
  insurance: { logout: logoutInsurance, loginHref: ROUTES.baoHiemDoiTacLogin },
  finance: { logout: logoutFinance, loginHref: ROUTES.taiChinhDoiTacLogin },
  rental: { logout: logoutRental, loginHref: ROUTES.thueTroDoiTacLogin },
} as const;

export function PortalLogoutButton({ portal = "training" }: { portal?: keyof typeof PORTAL_SESSION }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    const session = PORTAL_SESSION[portal];
    try {
      await session.logout();
    } catch {
      // Đăng xuất hỏng thì vẫn đưa về trang đăng nhập: cookie có thể đã bị xoá, và ở lại trong cổng
      // với phiên không chắc chắn thì rối hơn. Người dùng đăng nhập lại là xong.
    } finally {
      router.replace(session.loginHref);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="shrink-0 rounded-lg border border-white/25 px-3 py-1.5 text-[12px] font-bold text-white/85 transition hover:bg-white/10 disabled:opacity-50"
    >
      {busy ? "Đang thoát…" : "Đăng xuất"}
    </button>
  );
}
