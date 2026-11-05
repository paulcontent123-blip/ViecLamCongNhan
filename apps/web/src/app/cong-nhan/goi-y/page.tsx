import type { Metadata } from "next";
import { CandidateMatches } from "@/components/congnhan/CandidateMatches";
import { requireCandidatePage } from "@/lib/candidate-account-page";

export const metadata: Metadata = { title: "Gợi ý cho bạn | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function CongNhanMatchesPage() {
  await requireCandidatePage();

  return (
    <div className="bg-[#f6f7f9] px-4 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <CandidateMatches />
      </div>
    </div>
  );
}
