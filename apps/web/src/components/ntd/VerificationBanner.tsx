"use client";

import { useEffect, useState } from "react";

// Không có hạ tầng thông báo real-time (SSE/push) ‑ dùng localStorage để phát
// hiện lần đầu tiên tài khoản chuyển từ "chưa xác minh" -> "đã xác minh" trên
// trình duyệt này và hiện banner chúc mừng 1 lần, tự lưu lại để không lặp lại.
const STORAGE_KEY = "ntd_verification_seen";

export function VerificationBanner({ verified }: { verified: boolean }) {
  const [justVerified, setJustVerified] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const prev = localStorage.getItem(STORAGE_KEY);
    if (prev === "false" && verified) setJustVerified(true);
    localStorage.setItem(STORAGE_KEY, String(verified));
  }, [verified]);

  if (!verified) {
    return (
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
        ⏳ <strong>Tài khoản đang chờ Admin xác minh pháp nhân.</strong> Bạn có thể xem thông tin, nhưng
        chưa thể đăng tin, mua gói, gửi Blast SMS/Zalo, cập nhật ứng viên hay sửa hồ sơ công ty cho tới khi
        được xác minh.
      </div>
    );
  }

  if (!justVerified || dismissed) return null;

  return (
    <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="text-[13px] text-emerald-800">
        <strong>✅ Tài khoản đã được xác minh!</strong> Bạn có thể sử dụng đầy đủ chức năng: đăng tin, mua
        gói, gửi Blast SMS/Zalo, cập nhật ứng viên và sửa hồ sơ công ty.
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-[13px] font-bold text-emerald-600 hover:text-emerald-800"
      >
        ✕
      </button>
    </div>
  );
}
