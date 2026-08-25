import Link from "next/link";
import type { RightCardRow } from "@/lib/content";
import { ROUTES } from "@/lib/routes";

export function RightCardTile({ card }: { card: RightCardRow }) {
  return (
    <Link
      href={`${ROUTES.quyenLoi}/${card.slug}`}
      className="block rounded-xl border border-black/5 bg-white p-4 shadow-sm transition hover:border-brand-orange"
    >
      <div className="mb-2 text-[26px]">{card.icon}</div>
      <div className="mb-2 text-[14px] font-bold text-brand-navy">{card.title}</div>
      <div className="whitespace-pre-line text-[12.5px] leading-relaxed text-brand-navy/60">{card.summary}</div>
      {card.effective_note && (
        <div className="mt-2 text-[11.5px] text-brand-navy/35">{card.effective_note}</div>
      )}
    </Link>
  );
}
