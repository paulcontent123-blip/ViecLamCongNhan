import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { buildQuery } from "@/lib/url";

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("ellipsis");
    result.push(p);
    prev = p;
  }
  return result;
}

export function Pagination({
  currentPage,
  totalPages,
  sp,
  basePath = ROUTES.timViecLam,
  extraParams = { tab: "jobs" },
}: {
  currentPage: number;
  totalPages: number;
  sp: Record<string, string | undefined>;
  basePath?: string;
  extraParams?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (page: number) => `${basePath}${buildQuery(sp, { ...extraParams, page: String(page) })}`;
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5" aria-label="Phân trang">
      {currentPage > 1 ? (
        <Link
          href={hrefFor(currentPage - 1)}
          className="rounded-lg border border-black/10 px-3 py-2 text-[13px] font-semibold text-brand-navy/60 transition hover:border-brand-orange hover:text-brand-orange"
        >
          ← Trước
        </Link>
      ) : (
        <span className="rounded-lg border border-black/5 px-3 py-2 text-[13px] font-semibold text-brand-navy/25">
          ← Trước
        </span>
      )}

      {pageNumbers.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-1.5 text-[13px] text-brand-navy/30">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p)}
            className={`min-w-[38px] rounded-lg px-3 py-2 text-center text-[13px] font-bold transition ${
              p === currentPage
                ? "bg-brand-orange text-white"
                : "border border-black/10 text-brand-navy/60 hover:border-brand-orange hover:text-brand-orange"
            }`}
          >
            {p}
          </Link>
        ),
      )}

      {currentPage < totalPages ? (
        <Link
          href={hrefFor(currentPage + 1)}
          className="rounded-lg border border-black/10 px-3 py-2 text-[13px] font-semibold text-brand-navy/60 transition hover:border-brand-orange hover:text-brand-orange"
        >
          Sau →
        </Link>
      ) : (
        <span className="rounded-lg border border-black/5 px-3 py-2 text-[13px] font-semibold text-brand-navy/25">
          Sau →
        </span>
      )}
    </nav>
  );
}
