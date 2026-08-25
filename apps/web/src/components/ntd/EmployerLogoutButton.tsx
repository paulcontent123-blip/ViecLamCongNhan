"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROUTES } from "@/lib/routes";

export function EmployerLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/employer/logout", { method: "POST" });
    // Vào thẳng trang đăng nhập NTD thay vì trang chủ — tránh phải mở modal
    // rồi tự chuyển sang tab "Nhà tuyển dụng" mỗi lần muốn đăng nhập lại.
    router.push(ROUTES.ntdLogin);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-lg border border-black/10 px-4 py-2 text-[12.5px] font-bold text-brand-navy/70 transition hover:border-red-300 hover:text-red-600 disabled:opacity-60"
    >
      {loading ? "Đang đăng xuất..." : "Đăng xuất"}
    </button>
  );
}
