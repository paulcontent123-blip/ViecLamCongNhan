import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { getJobs } from "@/lib/jobs";
import { JobCard } from "@/components/timviec/JobCard";

export async function FeaturedJobs({
  selectedKcnId,
  selectedKcnName,
}: {
  selectedKcnId?: string;
  selectedKcnName?: string;
}) {
  const { jobs, total } = await getJobs({ sort: "newest", limit: 4, kcnId: selectedKcnId });

  if (jobs.length === 0 && !selectedKcnId) return null;

  const allJobsHref = selectedKcnId
    ? `${ROUTES.timViecLam}?tab=jobs&kcnId=${encodeURIComponent(selectedKcnId)}`
    : ROUTES.timViecLam;

  return (
    <div className="px-4 py-14 sm:px-8 lg:px-[52px]">
      <div className="mx-auto max-w-6xl">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">
          {selectedKcnName ? `Tin tuyển dụng tại ${selectedKcnName}` : "Tin tuyển dụng nổi bật"}
        </div>
        <h2 className="mt-2 text-[24px] font-extrabold text-brand-navy sm:text-[28px]">
          {selectedKcnName ? (
            <>
              Việc làm đang tuyển tại <em className="text-brand-orange not-italic">{selectedKcnName}</em>
            </>
          ) : (
            <>
              <em className="text-brand-orange not-italic">Đang tuyển gấp</em> — lương hấp dẫn
            </>
          )}
        </h2>

        {jobs.length > 0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-black/10 bg-white p-8 text-center text-[13.5px] text-brand-navy/50">
            KCN này hiện chưa có tin tuyển dụng đang hiển thị.
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href={allJobsHref}
            className="inline-block rounded-xl bg-brand-orange px-7 py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105"
          >
            {selectedKcnId ? `Xem tất cả ${total.toLocaleString("vi-VN")} tin tại KCN này →` : `Xem tất cả ${total.toLocaleString("vi-VN")}+ tin tuyển dụng →`}
          </Link>
        </div>
      </div>
    </div>
  );
}
