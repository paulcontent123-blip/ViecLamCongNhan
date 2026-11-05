"use client";

// "Việc đã lưu" của công nhân. Bản ghi lấy từ máy chủ nên luôn là thông tin mới nhất của tin; tin đã hết hạn hoặc không
// còn hiển thị được đánh dấu rõ. Việc đã lưu trên app (lưu cục bộ trên máy) chưa được đồng bộ sang đây.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { MobileActionAlert, MobilePager, MobileStateCard } from "@/components/shared/mobileUi";
import { useMobileAction, useMobileList } from "@/components/shared/useMobileList";
import { formatDate } from "@/lib/format-date";
import { industryLabel } from "@/lib/industries";
import { formatSalary } from "@/lib/job-format";
import { listSavedJobs, unsaveJob, type SavedJob } from "@/lib/candidate-matching-client";
import { PORTAL_ACCENT as accent } from "@/lib/portal-accent";
import { provinceName } from "@/lib/provinces";
import { ROUTES } from "@/lib/routes";
import { displayProvince } from "@/lib/worker-services";

function unavailable(job: NonNullable<SavedJob["job"]>) {
  if (job.status !== "approved") return "Tin đã ngừng hiển thị";
  if (job.expires_at && new Date(job.expires_at).getTime() <= Date.now()) return "Tin đã hết hạn";
  return "";
}

export function SavedJobs() {
  const router = useRouter();
  const expired = useCallback(() => router.replace(ROUTES.congNhanLogin), [router]);
  const list = useMobileList<SavedJob>((params) => listSavedJobs(params as Parameters<typeof listSavedJobs>[0]), {}, { onSessionExpired: expired });
  const action = useMobileAction(list.reload, expired);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-extrabold text-brand-navy">❤️ Việc đã lưu</h1>
          <p className="mt-1 text-[12.5px] text-brand-navy/55">
            Lưu tối đa 100 việc. Tin có thể đã thay đổi hoặc ngừng tuyển kể từ lúc bạn lưu.
          </p>
        </div>
        <Link href={ROUTES.timViecLam} className={`rounded-xl px-4 py-2 text-[13px] font-bold ${accent.button}`}>
          Tìm việc mới
        </Link>
      </div>

      <MobileActionAlert action={action} onReload={list.reload} />

      {list.error && (
        <div className="mb-3">
          <MobileStateCard
            tone="error"
            title="Chưa tải được việc đã lưu"
            description={list.items.length ? `Đang giữ danh sách đã tải trước đó. ${list.error}` : list.error}
            onRetry={list.reload}
          />
        </div>
      )}
      {list.loading && !list.items.length && !list.error && <MobileStateCard tone="loading" title="Đang tải việc đã lưu…" />}
      {list.loaded && !list.items.length && !list.loading && !list.error && (
        <MobileStateCard tone="empty" title="Chưa có việc đã lưu" description="Mở chi tiết một việc làm và bấm “Lưu việc” để xem lại sau." />
      )}

      {list.items.length > 0 && (
        <div className="flex flex-col gap-3">
          {list.items.map((item) => {
            const job = item.job;
            const busy = action.busyId === item.id;
            const disabled = busy || action.needsReload;
            const note = job ? unavailable(job) : "Tin không còn tồn tại";
            const place = job ? job.kcn?.name ?? job.district ?? displayProvince(job.province_code, provinceName) ?? "" : "";
            return (
              <article key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="min-w-0 flex-1">
                  {job ? (
                    <>
                      <div className="text-[12.5px] font-semibold text-brand-navy/50">{job.employers?.company_name ?? "Nhà tuyển dụng ẩn danh"}</div>
                      {note ? (
                        <div className="text-[14.5px] font-bold text-brand-navy/60">{job.title}</div>
                      ) : (
                        <Link href={`${ROUTES.timViecLam}/${job.slug}`} className="text-[14.5px] font-bold text-brand-navy hover:text-brand-orange">
                          {job.title}
                        </Link>
                      )}
                      <p className={`mt-1 text-[13px] font-extrabold ${accent.text}`}>{formatSalary(job.salary_min, job.salary_max)}</p>
                      <p className="mt-0.5 text-[12.5px] text-brand-navy/55">
                        {[place && `📍 ${place}`, job.industry && industryLabel(job.industry)].filter(Boolean).join(" · ")}
                      </p>
                    </>
                  ) : (
                    <div className="text-[14px] font-bold text-brand-navy/60">Tin tuyển dụng</div>
                  )}
                  <p className="mt-1 text-[11.5px] text-brand-navy/40">Đã lưu {formatDate(item.saved_at)}</p>
                  {note && <p className="mt-1.5 text-[12px] font-semibold text-amber-700">{note}</p>}
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => action.run(item.id, () => unsaveJob(item.id))}
                  className="rounded-lg border border-black/10 px-3 py-1.5 text-[11.5px] font-bold text-brand-navy/60 transition hover:border-red-300 hover:text-red-600 disabled:opacity-40"
                >
                  {busy ? "Đang bỏ lưu…" : "Bỏ lưu"}
                </button>
              </article>
            );
          })}
        </div>
      )}

      <MobilePager list={list} unit="việc" />
    </>
  );
}
