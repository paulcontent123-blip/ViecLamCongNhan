"use client";

import Link from "next/link";
import { useAuthModal } from "@/components/layout/AuthModalContext";

export function PackageCtaButton({
  loggedIn,
  href,
  label,
  className,
}: {
  loggedIn: boolean;
  href: string;
  label: string;
  className: string;
}) {
  const { openAuthModal } = useAuthModal();

  // flex + justify-center bắt buộc phải có ở đây (không chỉ dựa vào text-center của
  // className truyền vào) vì <Link> render ra thẻ <a> — mặc định display:inline nên
  // width/text-align không ăn, khiến nút bị co theo độ dài chữ thay vì full-width
  // và không nằm giữa thẻ gói.
  const baseClass = `${className} flex items-center justify-center`;

  if (loggedIn) {
    return (
      <Link href={href} className={baseClass}>
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => openAuthModal("employer")} className={baseClass}>
      {label}
    </button>
  );
}
