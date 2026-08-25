import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export function AdvertisingPricingAdminNav({ active }: { active: "manage" | "inquiries" }) {
  return (
    <div className="mb-5 border-b border-brand-navy/10">
      <Link
        href={ROUTES.adminAdPricing}
        aria-current={active === "manage" ? "page" : undefined}
        className={`relative -mb-px inline-flex items-center border-b-2 px-3 py-3 text-[13px] font-bold transition ${
          active === "manage"
            ? "border-brand-orange text-brand-orange"
            : "border-transparent text-brand-navy/60 hover:border-brand-orange/40 hover:text-brand-orange"
        }`}
      >
        🛠 Quản lý
      </Link>
      <Link
        href={ROUTES.adminAdPricingInquiries}
        aria-current={active === "inquiries" ? "page" : undefined}
        className={`relative -mb-px inline-flex items-center border-b-2 px-3 py-3 text-[13px] font-bold transition ${
          active === "inquiries"
            ? "border-brand-orange text-brand-orange"
            : "border-transparent text-brand-navy/60 hover:border-brand-orange/40 hover:text-brand-orange"
        }`}
      >
        📞 Yêu cầu tư vấn
      </Link>
    </div>
  );
}
