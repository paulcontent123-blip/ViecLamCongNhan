import type { Metadata } from "next";
import { CandidateAccount } from "@/components/congnhan/CandidateAccount";
import { requireCandidatePage } from "@/lib/candidate-account-page";

export const metadata: Metadata = { title: "Tài khoản công nhân | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function CongNhanAccountPage() {
  await requireCandidatePage();

  return (
    <div className="bg-[#f6f7f9] px-4 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <CandidateAccount />
      </div>
    </div>
  );
}
