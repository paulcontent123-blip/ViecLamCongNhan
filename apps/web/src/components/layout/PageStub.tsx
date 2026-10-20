import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export function PageStub({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-8">
      <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">{eyebrow}</div>
      <h1 className="mt-2 text-[26px] font-extrabold text-brand-navy sm:text-[30px]">{title}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-brand-navy/55">{description}</p>
      <p className="mt-1 text-[12.5px] text-brand-navy/35">
        Trang đang được xây dựng ‑ nội dung chi tiết sẽ được bổ sung ở bước tiếp theo.
      </p>
      <Link
        href={ROUTES.home}
        className="mt-6 inline-block rounded-xl bg-brand-orange px-6 py-3 text-[13.5px] font-bold text-white shadow-sm transition hover:brightness-105"
      >
        ← Về trang chủ
      </Link>
    </div>
  );
}
