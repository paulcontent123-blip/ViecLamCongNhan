// Lớp gọi API "Gợi ý cho bạn" và "Việc đã lưu" của công nhân trên web.
//
// Gợi ý dùng route có sẵn `api/mobile/candidate/{matches,match-preferences}` (app đang dùng). Việc đã lưu dùng route MỚI
// `api/mobile/candidate/saved-jobs`. Phiên là cookie `candidate_session`, cùng origin nên trình duyệt tự gửi.
//
// BẢN SAO QUY TẮC CỦA APP (`services/matchingApi.js`): gợi ý chỉ đọc nên tải lại an toàn; lưu tùy chọn là thao tác ghi,
// chưa rõ kết quả thì KHÔNG tự gửi lại.

import { MATCH_SERVICES, isId, serviceHref, type MatchService } from "@/lib/candidate-matching";
import { MobileApiError, createMobileClient, type MobileListResult } from "@/lib/mobile-session-client";
import type { JobWithRelations } from "@/types/db";

const candidate = createMobileClient({
  sessionLabel: "công nhân",
  uncertainMessage: "Chưa xác định thao tác đã được lưu hay chưa. Tải lại trước khi thử lại.",
});

const text = (value: unknown) => (typeof value === "string" ? value : "");

// ───────── Gợi ý ─────────

export type MatchedJob = { job: JobWithRelations; score: number | null; reasons: string[] };
export type MatchedService = { type: string; id?: string; title: string; subtitle: string; reasons: string[]; href: string };
export type MatchResult = {
  personalized: boolean;
  semantic: boolean;
  servicesIncomplete: boolean;
  completeness: { filled: number; total: number; missing: string[] };
  jobs: MatchedJob[];
  services: MatchedService[];
};

export async function getMatches(): Promise<MatchResult> {
  // `get` yêu cầu `ok: true` và trả nguyên thân; việc kiểm tra cấu trúc làm bên dưới như app.
  const data = (await candidate.get<Record<string, unknown>>("candidate/matches")) as Record<string, unknown>;
  const completeness = data.completeness as { filled?: unknown; total?: unknown; missing?: unknown } | undefined;
  if (
    !Array.isArray(data.jobs) ||
    !Array.isArray(data.services) ||
    !completeness ||
    !Number.isSafeInteger(completeness.filled) ||
    !Number.isSafeInteger(completeness.total) ||
    !Array.isArray(completeness.missing)
  ) {
    throw new MobileApiError("Phản hồi gợi ý không hợp lệ.", 0, "RESPONSE");
  }

  const jobs: MatchedJob[] = [];
  for (const item of data.jobs as Record<string, unknown>[]) {
    const job = item?.job as (Partial<JobWithRelations> & Record<string, unknown>) | undefined;
    const score = item?.score;
    const valid = job && isId(job.id) && typeof job.title === "string" && typeof job.slug === "string";
    const scoreOk = score === null || (typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100);
    if (!valid || !scoreOk || !Array.isArray(item.reasons)) continue;
    jobs.push({
      job: job as unknown as JobWithRelations,
      score: score as number | null,
      reasons: (item.reasons as unknown[]).filter((reason): reason is string => typeof reason === "string"),
    });
  }

  const services: MatchedService[] = [];
  for (const item of data.services as Record<string, unknown>[]) {
    if (!item || typeof item.type !== "string" || typeof item.title !== "string") continue;
    const params = item.params as { courseId?: string } | undefined;
    const href = serviceHref(text(item.screen), params);
    if (!href) continue;
    services.push({
      type: item.type,
      id: isId(item.id) ? item.id : undefined,
      title: item.title,
      subtitle: text(item.subtitle),
      reasons: Array.isArray(item.reasons) ? (item.reasons as unknown[]).filter((r): r is string => typeof r === "string") : [],
      href,
    });
  }

  return {
    personalized: data.personalized === true,
    semantic: data.semantic === true,
    servicesIncomplete: data.servicesIncomplete === true,
    completeness: {
      filled: completeness.filled as number,
      total: completeness.total as number,
      missing: (completeness.missing as unknown[]).filter((m): m is string => typeof m === "string"),
    },
    jobs,
    services,
  };
}

// ───────── Tùy chọn gợi ý ─────────

export type MatchPreferences = { workProvinceCode: string; kcnId: string; interestedServices: MatchService[] };

export async function getPreferences(): Promise<MatchPreferences> {
  const data = await candidate.get<{ preferences?: Record<string, unknown> }>("candidate/match-preferences");
  const prefs = data.preferences;
  if (!prefs || !Array.isArray(prefs.interestedServices)) throw new MobileApiError("Phản hồi tùy chọn gợi ý không hợp lệ.", 0, "RESPONSE");
  return {
    workProvinceCode: text(prefs.workProvinceCode),
    kcnId: isId(prefs.kcnId) ? prefs.kcnId : "",
    interestedServices: (prefs.interestedServices as unknown[]).filter((s): s is MatchService => MATCH_SERVICES.includes(s as MatchService)),
  };
}

/** Ghi không tự gửi lại: mất mạng hay 5xx thì chưa rõ đã lưu hay chưa, người dùng mở lại màn để kiểm tra. */
export async function updatePreferences(values: MatchPreferences): Promise<void> {
  await candidate.patch(
    "candidate/match-preferences",
    {
      workProvinceCode: values.workProvinceCode || null,
      kcnId: values.kcnId || null,
      interestedServices: [...new Set(values.interestedServices)],
    },
    { uncertainMessage: "Chưa xác định được tùy chọn đã lưu hay chưa. Tải lại màn này để kiểm tra trước khi lưu lần nữa." },
  );
}

/** Danh sách KCN của một tỉnh (route công khai có sẵn `api/kcn`). */
export async function listKcn(provinceCode: string): Promise<{ id: string; name: string }[]> {
  const response = await fetch(`/api/kcn?province=${encodeURIComponent(provinceCode)}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new MobileApiError("Chưa tải được danh sách khu công nghiệp.", response.status, "HTTP");
  const data = (await response.json().catch(() => null)) as { kcn?: unknown } | null;
  if (!Array.isArray(data?.kcn)) throw new MobileApiError("Danh sách khu công nghiệp không hợp lệ.", 0, "RESPONSE");
  return (data.kcn as Record<string, unknown>[])
    .filter((item) => isId(item?.id) && typeof item.name === "string")
    .map((item) => ({ id: item.id as string, name: item.name as string }));
}

// ───────── Việc đã lưu ─────────

export type SavedJob = {
  id: string;
  saved_at: string;
  job: {
    id: string;
    slug: string;
    title: string;
    province_code: string | null;
    district: string | null;
    industry: string | null;
    salary_min: number | null;
    salary_max: number | null;
    status: string;
    expires_at: string | null;
    created_at: string;
    employers: { company_name: string } | null;
    kcn: { name: string } | null;
  } | null;
};

export const listSavedJobs = (params: { page?: number; pageSize?: number }): Promise<MobileListResult<SavedJob>> =>
  candidate.list<SavedJob>("candidate/saved-jobs", { ...params });

export async function isJobSaved(jobId: string): Promise<boolean> {
  const data = await candidate.get<{ saved?: unknown }>(`candidate/saved-jobs?check=${encodeURIComponent(jobId)}`);
  return data.saved === true;
}

/** Lưu một việc. Lặp lại an toàn (đã lưu thì trả thành công), nên có thể thử lại khi chưa rõ kết quả. */
export async function saveJob(jobId: string): Promise<void> {
  const data = await candidate.post<{ saved?: unknown }>("candidate/saved-jobs", { jobId });
  if (data.saved !== true) throw new MobileApiError("Chưa xác nhận được việc đã lưu.", 0, "UNCERTAIN");
}

export async function unsaveJob(jobId: string): Promise<void> {
  const data = await candidate.delete<{ saved?: unknown }>(`candidate/saved-jobs?jobId=${encodeURIComponent(jobId)}`);
  if (data.saved !== false) throw new MobileApiError("Chưa xác nhận được việc đã bỏ lưu.", 0, "UNCERTAIN");
}
