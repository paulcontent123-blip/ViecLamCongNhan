"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { CampaignCard } from "@/components/timviec/CampaignCard";
import type { JobWithRelations } from "@/types/db";

// Ô CTA "Dành cho doanh nghiệp" luôn chiếm 1 suất cuối lưới, nên mỗi trang tối đa
// 9 chiến dịch thật + 1 CTA = 10 ô — khớp ví dụ "10 ô = 9 chiến dịch + 1 CTA".
const CAMPAIGNS_PER_PAGE = 9;

// Tailwind cần class literal (không ghép chuỗi động) để JIT nhận diện lúc build.
const COLS_CLASS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
};

/** Số cột sao cho các hàng đều nhau nhất có thể, tối đa 5 cột — từ 6 ô trở lên
 * luôn xếp 2 hàng (VD 6→3x2, 9→5x2 dư 1, 10→5x2 đủ); từ 5 ô trở xuống xếp 1 hàng. */
function columnsFor(totalCells: number): number {
  const rows = totalCells <= 5 ? 1 : 2;
  return Math.min(5, Math.ceil(totalCells / rows));
}

export function CampaignGrid({
  campaigns,
  candidatesCount,
}: {
  campaigns: JobWithRelations[];
  candidatesCount: number;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE));
  const start = (page - 1) * CAMPAIGNS_PER_PAGE;
  const pageCampaigns = campaigns.slice(start, start + CAMPAIGNS_PER_PAGE);
  const cols = columnsFor(pageCampaigns.length + 1);

  function goTo(p: number) {
    setPage(Math.min(totalPages, Math.max(1, p)));
  }

  return (
    <>
      <div className={`mt-6 grid gap-4 ${COLS_CLASS[cols]}`}>
        {pageCampaigns.map((job) => (
          <CampaignCard key={job.id} job={job} />
        ))}

        <Link
          href={ROUTES.tuyenDung}
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-orange/30 bg-brand-orange-light p-6 text-center transition hover:border-brand-orange"
        >
          <div className="text-[32px]">➕</div>
          <div className="mt-2 text-[13px] font-bold uppercase tracking-wide text-brand-orange">
            Dành cho doanh nghiệp
          </div>
          <div className="mt-1 text-[14px] font-bold text-brand-navy">Đăng chiến dịch tuyển dụng của bạn</div>
          <div className="mt-1.5 text-[12px] text-brand-navy/50">
            Tiếp cận {candidatesCount.toLocaleString("vi-VN")} ứng viên công nhân
          </div>
        </Link>
      </div>

      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-1.5" aria-label="Phân trang chiến dịch">
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            disabled={page === 1}
            className="rounded-lg border border-black/10 px-3 py-2 text-[13px] font-semibold text-brand-navy/60 transition hover:border-brand-orange hover:text-brand-orange disabled:cursor-not-allowed disabled:border-black/5 disabled:text-brand-navy/25"
          >
            ← Trước
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => goTo(p)}
              className={`min-w-[38px] rounded-lg px-3 py-2 text-center text-[13px] font-bold transition ${
                p === page
                  ? "bg-brand-orange text-white"
                  : "border border-black/10 text-brand-navy/60 hover:border-brand-orange hover:text-brand-orange"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => goTo(page + 1)}
            disabled={page === totalPages}
            className="rounded-lg border border-black/10 px-3 py-2 text-[13px] font-semibold text-brand-navy/60 transition hover:border-brand-orange hover:text-brand-orange disabled:cursor-not-allowed disabled:border-black/5 disabled:text-brand-navy/25"
          >
            Sau →
          </button>
        </nav>
      )}
    </>
  );
}
