import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import type { KcnRow } from "@/types/db";

export function KcnFilterBar({ kcnList, selectedId }: { kcnList: KcnRow[]; selectedId?: string }) {
  return (
    <div className="bg-brand-orange-2 px-4 py-3 sm:px-8 lg:px-[52px]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2.5">
        <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[1.5px] text-white/55">
          Lọc theo KCN
        </span>

        <div className="flex flex-wrap gap-1.5">
          <Link
            href={ROUTES.home}
            aria-current={!selectedId ? "page" : undefined}
            className={`whitespace-nowrap rounded-md border px-3.5 py-1.5 text-[12px] font-bold transition ${
              !selectedId
                ? "border-white/50 bg-white/20 text-white"
                : "border-white/10 bg-white/[0.08] text-white/75 hover:border-white/30 hover:bg-white/20 hover:text-white"
            }`}
          >
            Tất cả
          </Link>

          {kcnList.map((kcn) => {
            const active = selectedId === kcn.id;
            return (
              <Link
                key={kcn.id}
                href={`${ROUTES.home}?kcnId=${encodeURIComponent(kcn.id)}`}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-md border px-3.5 py-1.5 text-[12px] font-bold transition ${
                  active
                    ? "border-white/50 bg-white/20 text-white"
                    : "border-white/10 bg-white/[0.08] text-white/75 hover:border-white/30 hover:bg-white/20 hover:text-white"
                }`}
              >
                {kcn.name}
              </Link>
            );
          })}

          <Link
            href={`${ROUTES.timViecLam}?tab=kcn`}
            className="whitespace-nowrap rounded-md border border-white/10 bg-transparent px-3.5 py-1.5 text-[12px] font-bold text-white/75 transition hover:border-white/30 hover:bg-white/20 hover:text-white"
          >
            Xem tất cả KCN →
          </Link>
        </div>
      </div>
    </div>
  );
}
