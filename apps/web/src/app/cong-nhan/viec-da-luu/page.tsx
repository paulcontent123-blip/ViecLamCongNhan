import type { Metadata } from "next";
import { SavedJobs } from "@/components/congnhan/SavedJobs";
import { requireCandidatePage } from "@/lib/candidate-account-page";

export const metadata: Metadata = { title: "Việc đã lưu | ViecLamCongNhan.com" };
export const dynamic = "force-dynamic";

export default async function CongNhanSavedPage() {
  await requireCandidatePage();

  return (
    <div className="bg-[#f6f7f9] px-4 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <SavedJobs />
      </div>
    </div>
  );
}
