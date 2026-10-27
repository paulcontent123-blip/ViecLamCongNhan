import { NextResponse } from "next/server";
import { getCandidateSession } from "@/lib/candidate-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logSafeSupabaseError } from "@/lib/supabase/safe-error-log";
import { consumeRateLimit, rateLimitUnavailable, tooManyRequests } from "@/lib/rate-limit";
import { normalizeIndustryText } from "@/lib/industries";
import { provinceName } from "@/lib/provinces";
import { resolveProvinceCode } from "@/lib/ai-matching/location";
import { profileCompleteness, rankJobs, scoreCourse, scoreRental, type MatchJob, type MatchProfile, type Shift } from "@/lib/ai-matching/scoring";
import { buildJobEmbeddingText, buildProfileEmbeddingText, contentHash, cosineSimilarity, embedTexts, getEmbeddingConfig } from "@/lib/ai-matching/embeddings";

const headers = { "Cache-Control": "private, no-store" };
const JOB_SELECT = "*, employers(company_name, company_logo_url), kcn(name)";
const MAX_JOBS = 300;
const SEMANTIC_CANDIDATES = 60;
const SEMANTIC_NEW_EMBEDDINGS = 24;
const RESULT_LIMIT = 20;
const MIN_SCORE = 25;
const SHIFTS: readonly string[] = ["day", "night", "rotating", "flexible"];
const isMissingPreferencesTable = (error: unknown) => !!error && typeof error === "object" &&
  String((error as { code?: unknown }).code ?? "") === "42P01";

type JobRow = Record<string, unknown> & {
  id: string; title: string; description: string; requirements: string | null; industry: string | null; industry_key: string | null;
  province_code: string; kcn_id: string | null; salary_min: number | null; salary_max: number | null; shift_type: string | null;
  has_housing: boolean | null; no_experience_required: boolean | null; is_urgent: boolean | null; created_at: string;
  district: string | null; kcn: { name: string } | { name: string }[] | null;
};

const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

function toMatchJob(row: JobRow): MatchJob {
  return {
    id: row.id, industryKey: row.industry_key || (row.industry ? normalizeIndustryText(row.industry) : null), provinceCode: row.province_code, kcnId: row.kcn_id,
    salaryMin: row.salary_min, salaryMax: row.salary_max, shiftType: row.shift_type, hasHousing: row.has_housing === true,
    noExperienceRequired: row.no_experience_required === true, isUrgent: row.is_urgent === true, createdAt: row.created_at,
  };
}

export async function GET() {
  const session = await getCandidateSession({ allowUnverifiedPasswordSession: true });
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập để xem gợi ý." }, { status: 401, headers });

  // Giới hạn theo tài khoản: mỗi lần gọi có thể tốn truy vấn và một lượt Gemini.
  const limit = await consumeRateLimit({ scope: "ai-match", key: session.userId, limit: 30, windowSeconds: 3600 });
  if (!limit.available) return rateLimitUnavailable(limit);
  if (!limit.allowed) return tooManyRequests("Bạn đã làm mới gợi ý quá nhiều lần.", limit.retryAfterSeconds);

  const supabase = createSupabaseAdminClient();
  const [candidateResult, prefsResult] = await Promise.all([
    supabase.from("candidates")
      .select("province,desired_industry,desired_industry_key,desired_salary_min,experience_years,preferred_shift,needs_housing")
      .eq("user_id", session.userId).order("created_at", { ascending: false }).limit(1),
    supabase.from("candidate_match_preferences").select("work_province_code,kcn_id,interested_services").eq("user_id", session.userId).maybeSingle(),
  ]);
  if (candidateResult.error) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/candidate/matches", operation: "load_profile", error: candidateResult.error });
    return NextResponse.json({ error: "Chưa tải được hồ sơ để gợi ý.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  // Chỉ thiếu bảng do chưa áp migration mới được xem như chưa cài tùy chọn; lỗi truy vấn khác phải hiện rõ.
  if (prefsResult.error && !isMissingPreferencesTable(prefsResult.error)) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/candidate/matches", operation: "load_preferences", error: prefsResult.error });
    return NextResponse.json({ error: "Chưa tải được tùy chọn gợi ý.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  const prefs = prefsResult.error ? null : prefsResult.data;
  const row = candidateResult.data?.[0] ?? null;

  let kcnName: string | null = null;
  if (prefs?.kcn_id) {
    const { data: kcn, error } = await supabase.from("kcn").select("name").eq("id", prefs.kcn_id).maybeSingle();
    if (error) logSafeSupabaseError({ route: "/api/mobile/candidate/matches", operation: "load_selected_kcn", error });
    kcnName = kcn?.name ?? null;
  }

  const industryText: string | null = row?.desired_industry || null;
  const shift = typeof row?.preferred_shift === "string" && SHIFTS.includes(row.preferred_shift) ? (row.preferred_shift as Shift) : null;
  const profile: MatchProfile = {
    industryKey: row?.desired_industry_key || (industryText ? normalizeIndustryText(industryText) : null),
    workProvinceCode: prefs?.work_province_code || null,
    homeProvinceCode: resolveProvinceCode(row?.province),
    kcnId: prefs?.kcn_id || null,
    salaryMin: row?.desired_salary_min ?? null,
    experienceYears: row?.experience_years ?? null,
    shift,
    needsHousing: typeof row?.needs_housing === "boolean" ? row.needs_housing : null,
  };
  const interests: string[] = Array.isArray(prefs?.interested_services) ? prefs.interested_services : [];
  const completeness = profileCompleteness(profile);

  const { data: jobData, error: jobError } = await supabase.from("jobs").select(JOB_SELECT)
    .eq("status", "approved").or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false }).limit(MAX_JOBS);
  if (jobError) {
    const requestId = logSafeSupabaseError({ route: "/api/mobile/candidate/matches", operation: "load_jobs", error: jobError });
    return NextResponse.json({ error: "Chưa tải được việc làm để gợi ý.", requestId }, { status: 503, headers: { ...headers, "X-Request-Id": requestId } });
  }
  const rows = (jobData || []) as unknown as JobRow[];
  const byId = new Map(rows.map(job => [job.id, job]));
  const matchJobs = rows.map(toMatchJob);

  // Hồ sơ chưa có tiêu chí nào: không cá nhân hóa, chỉ trả tin mới nhất để màn không trống.
  const personalized = completeness.filled > 0;
  let semanticUsed = false;
  let ranked = rankJobs(profile, matchJobs);

  if (personalized) {
    const config = getEmbeddingConfig();
    const top = ranked.slice(0, SEMANTIC_CANDIDATES);
    const profileText = buildProfileEmbeddingText({
      industry: industryText, provinceName: profile.workProvinceCode ? provinceName(profile.workProvinceCode) : null,
      kcnName, shift: profile.shift, needsHousing: profile.needsHousing, experienceYears: profile.experienceYears,
    });
    if (config.enabled && profileText && top.length) {
      const texts = new Map(top.map(item => {
        const job = byId.get(item.job.id) as JobRow;
        const kcn = one(job.kcn);
        return [item.job.id, buildJobEmbeddingText({ title: job.title, description: job.description, requirements: job.requirements, industry: job.industry, location: [job.district, kcn?.name].filter(Boolean).join(", ") || null })];
      }));
      const ids = [...texts.keys()];
      const { data: cached } = await supabase.from("ai_embeddings").select("entity_id,content_hash,embedding").eq("entity_type", "job").eq("model", config.cacheKey).in("entity_id", ids);
      const vectors = new Map<string, number[]>();
      for (const entry of cached || []) {
        if (entry.content_hash === contentHash(texts.get(entry.entity_id) || "") && Array.isArray(entry.embedding)) vectors.set(entry.entity_id, entry.embedding as number[]);
      }
      const missing = ids.filter(id => !vectors.has(id)).slice(0, SEMANTIC_NEW_EMBEDDINGS);
      const embedded = await embedTexts([profileText, ...missing.map(id => texts.get(id) as string)], config);
      if (embedded) {
        const profileVector = embedded[0];
        missing.forEach((id, index) => vectors.set(id, embedded[index + 1]));
        if (missing.length) {
          // Ghi bộ nhớ đệm tốt nhất có thể; lỗi ghi không ảnh hưởng kết quả.
          await supabase.from("ai_embeddings").upsert(missing.map((id, index) => ({
            entity_type: "job", entity_id: id, model: config.cacheKey, content_hash: contentHash(texts.get(id) as string), embedding: embedded[index + 1], updated_at: new Date().toISOString(),
          })), { onConflict: "entity_type,entity_id,model" });
        }
        // Dọn vector của tin đã xóa, hết hạn hoặc quá cũ; chỉ chạy ngẫu nhiên khoảng 5% số lần để không tốn chi phí mỗi yêu cầu.
        if (Math.random() < 0.05) {
          try { await supabase.rpc("cleanup_ai_embeddings"); } catch { /* bỏ qua: chưa áp migration dọn dẹp */ }
        }
        const similarity = new Map<string, number>();
        for (const id of ids) { const vector = vectors.get(id); if (vector) similarity.set(id, cosineSimilarity(profileVector, vector)); }
        if (similarity.size) { ranked = rankJobs(profile, top.map(item => item.job), similarity); semanticUsed = true; }
      }
    }
    ranked = ranked.filter(item => item.finalScore >= MIN_SCORE);
  } else {
    // Không dùng tỉnh cư trú để cá nhân hóa hay xếp lại danh sách việc mới nhất.
    ranked = rows.slice(0, 10).map(job => ({
      job: toMatchJob(job), result: { score: 0, coverage: 0, reasons: [] }, finalScore: 0, reasons: [],
    }));
  }

  const jobs = ranked.slice(0, RESULT_LIMIT).map(item => ({ job: byId.get(item.job.id), score: personalized ? item.finalScore : null, reasons: personalized ? item.reasons : [] }));
  const kcnKey = kcnName ? normalizeIndustryText(kcnName) : (() => { const first = jobs[0]?.job; const kcn = first ? one((first as JobRow).kcn) : null; return kcn?.name ? normalizeIndustryText(kcn.name) : null; })();
  const serviceResult = await buildServices(supabase, profile, interests, kcnKey);

  return NextResponse.json({
    ok: true, personalized, semantic: semanticUsed,
    completeness: { filled: completeness.filled, total: completeness.total, missing: completeness.missing },
    jobs, services: serviceResult.services, servicesIncomplete: serviceResult.incomplete,
  }, { headers });
}

type Service = { type: string; id?: string; title: string; subtitle?: string; reasons: string[]; screen: string; params?: Record<string, string> };

async function buildServices(supabase: ReturnType<typeof createSupabaseAdminClient>, profile: MatchProfile, interests: string[], kcnKey: string | null): Promise<{ services: Service[]; incomplete: boolean }> {
  const services: Service[] = [];
  let incomplete = false;
  const place = profile.workProvinceCode;
  const wantsHousing = profile.needsHousing === true || interests.includes("housing");

  if (wantsHousing && place) {
    try {
      const { data, error } = await supabase.from("rental_listings")
        .select("id,title,monthly_rent_vnd,province_code,location,nearby_industrial_zone,rental_providers!inner(is_verified)")
        .eq("status", "approved").eq("rental_providers.is_verified", true).eq("province_code", place).order("created_at", { ascending: false }).limit(30);
      if (error) {
        incomplete = true;
        logSafeSupabaseError({ route: "/api/mobile/candidate/matches", operation: "load_rental_services", error });
      }
      const scored = (error ? [] : data || []).map(item => ({ item, ...scoreRental(profile, { provinceCode: item.province_code, nearbyZone: item.nearby_industrial_zone, monthlyRentVnd: Number(item.monthly_rent_vnd) || 0 }, kcnKey) }))
        .filter(entry => entry.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
      for (const entry of scored) services.push({ type: "rental", id: entry.item.id, title: entry.item.title, subtitle: `${Number(entry.item.monthly_rent_vnd).toLocaleString("vi-VN")}đ/tháng · ${entry.item.location}`, reasons: entry.reasons, screen: "ThueTro" });
    } catch (error) {
      incomplete = true;
      logSafeSupabaseError({ route: "/api/mobile/candidate/matches", operation: "load_rental_services", error });
    }
  }

  if (interests.includes("training") && profile.industryKey) {
    try {
      const { data, error } = await supabase.from("vocational_courses")
        .select("id,title,occupation,province_code,learning_mode,training_providers!inner(is_verified)")
        .eq("status", "approved").eq("training_providers.is_verified", true).order("created_at", { ascending: false }).limit(40);
      if (error) {
        incomplete = true;
        logSafeSupabaseError({ route: "/api/mobile/candidate/matches", operation: "load_training_services", error });
      }
      const scored = (error ? [] : data || []).map(item => ({ item, ...scoreCourse(profile, { provinceCode: item.province_code, occupationKey: item.occupation ? normalizeIndustryText(item.occupation) : null, learningMode: item.learning_mode }) }))
        .filter(entry => entry.reasons.includes("industry_training")).sort((a, b) => b.score - a.score).slice(0, 3);
      for (const entry of scored) services.push({ type: "course", id: entry.item.id, title: entry.item.title, subtitle: entry.item.occupation, reasons: entry.reasons, screen: "VocationalCourseDetail", params: { courseId: entry.item.id } });
    } catch (error) {
      incomplete = true;
      logSafeSupabaseError({ route: "/api/mobile/candidate/matches", operation: "load_training_services", error });
    }
  }

  // Bảo hiểm, Y tế, Tài chính: chỉ hiện khi công nhân chủ động chọn quan tâm; không suy luận từ hồ sơ.
  if (interests.includes("insurance")) {
    try {
      const { data, error } = await supabase.from("insurance_products").select("id,title,subtitle,price_label,insurance_providers!inner(is_verified)")
        .eq("status", "approved").eq("insurance_providers.is_verified", true).order("published_at", { ascending: false }).limit(2);
      if (error) {
        incomplete = true;
        logSafeSupabaseError({ route: "/api/mobile/candidate/matches", operation: "load_insurance_services", error });
      }
      for (const item of error ? [] : data || []) services.push({ type: "insurance", id: item.id, title: item.title, subtitle: item.price_label || item.subtitle || undefined, reasons: ["chosen_interest"], screen: "BaoHiem" });
    } catch (error) {
      incomplete = true;
      logSafeSupabaseError({ route: "/api/mobile/candidate/matches", operation: "load_insurance_services", error });
    }
  }
  if (interests.includes("health")) services.push({ type: "health", title: "Dịch vụ Y tế", subtitle: "Bạn đã chọn quan tâm mục này", reasons: ["chosen_interest"], screen: "YTe" });
  if (interests.includes("finance")) services.push({ type: "finance", title: "Dịch vụ Tài chính", subtitle: "Bạn đã chọn quan tâm mục này", reasons: ["chosen_interest"], screen: "TaiChinh" });
  return { services, incomplete };
}
