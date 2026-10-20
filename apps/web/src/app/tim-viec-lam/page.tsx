import Link from "next/link";
import { getJobs, JOBS_PAGE_SIZE } from "@/lib/jobs";
import { getKcnList } from "@/lib/kcn";
import { ROUTES } from "@/lib/routes";
import { buildQuery } from "@/lib/url";
import { FilterSidebar } from "@/components/timviec/FilterSidebar";
import { JobCard } from "@/components/timviec/JobCard";
import { Pagination } from "@/components/timviec/Pagination";

function toSp(searchParams: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    out[k] = Array.isArray(v) ? v[0] : v;
  }
  return out;
}

// `toggleKey` là searchParam mà chip này bật/tắt ‑ bấm lần 2 khi đang active sẽ xoá
// đúng param đó (không đụng các bộ lọc khác), thay vì phải tải lại trang mới bỏ được.
// "Tất cả" không có toggleKey vì bản thân nó đã là nút "xoá hết" (không cần bật/tắt).
// Toàn bộ tham số coi là "bộ lọc" (không tính tab/page) ‑ dùng để biết có đang lọc
// gì hay không, hiện nút "Xóa tất cả bộ lọc" khi cần.
const FILTER_PARAM_KEYS = [
  "q",
  "province",
  "industry",
  "salaryMin",
  "shift",
  "housing",
  "shuttle",
  "meals",
  "noExperience",
  "urgent",
  "sort",
  "kcnId",
] as const;

const quickFilters = [
  { label: "Tất cả", overrides: { urgent: undefined, housing: undefined, noExperience: undefined, shift: undefined, sort: undefined }, toggleKey: null, isActive: (sp: Record<string, string | undefined>) => !sp.urgent && !sp.housing && !sp.noExperience && !sp.shift && sp.sort !== "salary_desc" },
  { label: "⚡ Tuyển gấp", overrides: { urgent: "1" }, toggleKey: "urgent" as const, isActive: (sp: Record<string, string | undefined>) => sp.urgent === "1" },
  { label: "💰 Lương cao nhất", overrides: { sort: "salary_desc" }, toggleKey: "sort" as const, isActive: (sp: Record<string, string | undefined>) => sp.sort === "salary_desc" },
  { label: "🏠 Có nhà ở", overrides: { housing: "1" }, toggleKey: "housing" as const, isActive: (sp: Record<string, string | undefined>) => sp.housing === "1" },
  { label: "🔰 Không cần KN", overrides: { noExperience: "1" }, toggleKey: "noExperience" as const, isActive: (sp: Record<string, string | undefined>) => sp.noExperience === "1" },
  { label: "☀️ Ca ngày", overrides: { shift: "day" }, toggleKey: "shift" as const, isActive: (sp: Record<string, string | undefined>) => sp.shift === "day" },
  { label: "🌙 Ca đêm", overrides: { shift: "night" }, toggleKey: "shift" as const, isActive: (sp: Record<string, string | undefined>) => sp.shift === "night" },
];

export default async function TimViecLamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawSp = await searchParams;
  const sp = toSp(rawSp);
  const tab = sp.tab === "kcn" ? "kcn" : "jobs";

  const currentPage = Math.max(1, sp.page ? Number(sp.page) || 1 : 1);
  const hasActiveFilters = FILTER_PARAM_KEYS.some((k) => sp[k]);

  const [{ jobs, total }, kcnList] = await Promise.all([
    tab === "jobs"
      ? getJobs({
          province: sp.province,
          industry: sp.industry,
          kcnId: sp.kcnId,
          salaryMin: sp.salaryMin ? Number(sp.salaryMin) : undefined,
          urgent: sp.urgent === "1",
          housing: sp.housing === "1",
          shuttle: sp.shuttle === "1",
          meals: sp.meals === "1",
          noExperience: sp.noExperience === "1",
          shift: sp.shift as "day" | "night" | "rotating" | undefined,
          q: sp.q,
          sort: sp.sort === "salary_desc" ? "salary_desc" : "newest",
          limit: JOBS_PAGE_SIZE,
          offset: (currentPage - 1) * JOBS_PAGE_SIZE,
        })
      : Promise.resolve({ jobs: [], total: 0 }),
    tab === "kcn" ? getKcnList() : Promise.resolve([]),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / JOBS_PAGE_SIZE));

  return (
    <div className="px-4 pb-20 pt-10 sm:px-8 lg:px-[52px]">
      <div className="mx-auto max-w-6xl">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand-orange">Cơ hội việc làm</div>
        <h1 className="mt-2 text-[26px] font-extrabold text-brand-navy sm:text-[30px]">
          Tìm việc làm <em className="text-brand-orange not-italic">công nhân</em> &amp; Khám phá KCN
        </h1>
        <p className="mt-2 text-[13.5px] text-brand-navy/50">
          {total > 0 ? `${total.toLocaleString("vi-VN")} tin tuyển dụng` : "Tin tuyển dụng"} · Lọc theo lương, ca làm, ngành nghề
        </p>

        {/* Tab bar */}
        <div className="mt-6 flex gap-2 border-b border-black/5">
          <Link
            href={`${ROUTES.timViecLam}?tab=jobs`}
            className={`rounded-t-lg px-4 py-2.5 text-[13.5px] font-bold transition ${
              tab === "jobs" ? "border-b-2 border-brand-orange text-brand-orange" : "text-brand-navy/50 hover:text-brand-navy"
            }`}
          >
            🔍 Tìm việc theo tin tuyển dụng
          </Link>
          <Link
            href={`${ROUTES.timViecLam}?tab=kcn`}
            className={`rounded-t-lg px-4 py-2.5 text-[13.5px] font-bold transition ${
              tab === "kcn" ? "border-b-2 border-brand-orange text-brand-orange" : "text-brand-navy/50 hover:text-brand-navy"
            }`}
          >
            🏭 KCN toàn quốc
          </Link>
        </div>

        {tab === "jobs" ? (
          <div className="mt-6">
            {/* Quick filter row */}
            <div className="mb-5 flex flex-wrap gap-2">
              {quickFilters.map((qf) => {
                const active = qf.isActive(sp);
                // Đang active + có toggleKey (mọi chip trừ "Tất cả") → bấm lần 2 chỉ xoá
                // đúng param của chip này, giữ nguyên các bộ lọc khác đang chọn.
                const overrides = active && qf.toggleKey ? { [qf.toggleKey]: undefined } : qf.overrides;
                return (
                  <Link
                    key={qf.label}
                    href={`${ROUTES.timViecLam}${buildQuery(sp, { ...overrides, tab: "jobs" })}`}
                    className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                      active
                        ? "border-brand-orange bg-brand-orange text-white"
                        : "border-black/10 bg-white text-brand-navy/60 hover:border-brand-orange hover:text-brand-orange"
                    }`}
                  >
                    {qf.label}
                  </Link>
                );
              })}
            </div>

            {hasActiveFilters && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-brand-orange-light px-3.5 py-2 text-[12.5px] font-semibold text-brand-orange">
                {sp.kcnId ? "Đang lọc theo KCN đã chọn" : "Đang áp dụng bộ lọc tìm kiếm"}
                <Link href={`${ROUTES.timViecLam}?tab=jobs`} className="underline">
                  ✕ Xóa tất cả bộ lọc
                </Link>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
              <FilterSidebar sp={sp} />

              <div>
                {jobs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
                    Không tìm thấy tin tuyển dụng phù hợp. Thử bỏ bớt bộ lọc.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {jobs.map((job) => (
                      <JobCard key={job.id} job={job} />
                    ))}
                  </div>
                )}

                {total > 0 && (
                  <div className="mt-6 text-center text-[12.5px] text-brand-navy/45">
                    Trang {currentPage}/{totalPages} ‑ hiển thị {jobs.length} / {total} tin
                  </div>
                )}
                <Pagination currentPage={currentPage} totalPages={totalPages} sp={sp} />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <p className="mb-5 text-[13.5px] text-brand-navy/50">
              {kcnList.length} khu công nghiệp đã có trong hệ thống ‑ bấm vào KCN để xem tin tuyển dụng đang có.
            </p>
            {kcnList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
                Chưa có dữ liệu KCN.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {kcnList.map((kcn) => (
                  <Link
                    key={kcn.id}
                    href={`${ROUTES.timViecLam}?tab=jobs&kcnId=${kcn.id}`}
                    className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition hover:shadow-md hover:border-brand-orange/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-orange-light text-xl">
                        🏭
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-bold text-brand-navy">{kcn.name}</div>
                        <div className="text-[12px] text-brand-navy/45">{kcn.province_name}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-brand-navy/55">
                      <span>👥 {kcn.active_companies} doanh nghiệp</span>
                      <span className="font-bold text-brand-orange">💼 {kcn.active_jobs} tin đang tuyển</span>
                    </div>
                    {kcn.address && <div className="mt-2 text-[11.5px] text-brand-navy/40">📍 {kcn.address}</div>}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
