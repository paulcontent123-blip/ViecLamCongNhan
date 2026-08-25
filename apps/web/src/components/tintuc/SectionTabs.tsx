import Link from "next/link";
import { ROUTES } from "@/lib/routes";

const TABS = [
  { href: ROUTES.tinTucQuyenLoi, icon: "📰", label: "Tin tức & Bài viết" },
  { href: ROUTES.quyenLoi, icon: "⚖", label: "Quyền lợi & Pháp lý" },
  { href: ROUTES.hoiDap, icon: "❓", label: "Hỏi đáp" },
] as const;

/** Tab điều hướng thật (Link, không phải JS toggle) giữa 3 trang con của mục
 * "Tin tức & Quyền lợi". `active` được page cha truyền vào vì layout không biết
 * route con nào đang active khi dùng route group tĩnh. */
export function SectionTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <div className="mb-[18px] flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`rounded-lg px-4 py-2.5 text-[13px] font-bold transition ${
            active === tab.href
              ? "bg-brand-orange text-white"
              : "border border-black/10 bg-white text-brand-navy/60 hover:border-brand-orange/40 hover:text-brand-orange"
          }`}
        >
          {tab.icon} {tab.label}
        </Link>
      ))}
    </div>
  );
}
