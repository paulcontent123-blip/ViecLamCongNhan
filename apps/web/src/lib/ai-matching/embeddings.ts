import { createHash } from "node:crypto";

// So khớp ngữ nghĩa bằng Gemini Embeddings. Chỉ gửi mô tả công khai của tin và các tùy chọn nghề nghiệp đã ẩn danh;
// không bao giờ gửi họ tên, SĐT, Zalo, email, ID tài khoản hay lịch sử ứng tuyển. Mọi lỗi đều trả null để dùng điểm cấu trúc.

export interface EmbeddingConfig {
  apiKey: string; model: string; timeoutMs: number; enabled: boolean;
  /** Số chiều vector yêu cầu Gemini trả về (0 = mặc định của model). Giảm chiều để tiết kiệm dung lượng lưu trữ. */
  dimensions: number;
  /** Khóa bộ nhớ đệm: đổi model hoặc số chiều thì không dùng lại vector cũ. */
  cacheKey: string;
}

export const DEFAULT_EMBEDDING_DIMENSIONS = 768;

export function getEmbeddingConfig(env: Record<string, string | undefined> = process.env): EmbeddingConfig {
  const apiKey = (env.GEMINI_API_KEY || "").trim();
  // Tên model đặt ở cấu hình để đổi khi Google cập nhật; không cài cứng trong mã.
  const model = (env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001").trim();
  const requested = Number(env.GEMINI_EMBEDDING_DIMENSIONS);
  const dimensions = env.GEMINI_EMBEDDING_DIMENSIONS === undefined || env.GEMINI_EMBEDDING_DIMENSIONS === ""
    ? DEFAULT_EMBEDDING_DIMENSIONS
    : Number.isInteger(requested) && requested >= 0 && requested <= 3072 ? requested : DEFAULT_EMBEDDING_DIMENSIONS;
  return {
    apiKey,
    model,
    dimensions,
    cacheKey: dimensions > 0 ? `${model}@${dimensions}` : model,
    timeoutMs: Number(env.GEMINI_TIMEOUT_MS) > 0 ? Number(env.GEMINI_TIMEOUT_MS) : 6000,
    enabled: apiKey.length > 0 && env.AI_MATCHING_SEMANTIC !== "off",
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0; let normA = 0; let normB = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

const clip = (value: string | null | undefined, max: number) => (value || "").replace(/\s+/g, " ").trim().slice(0, max);

export interface JobText { title: string; description: string; requirements: string | null; industry: string | null; location: string | null }

export function buildJobEmbeddingText(job: JobText): string {
  return [clip(job.title, 160), clip(job.industry, 80), clip(job.location, 120), clip(job.description, 900), clip(job.requirements, 400)].filter(Boolean).join("\n");
}

export interface ProfileText { industry: string | null; provinceName: string | null; kcnName: string | null; shift: string | null; needsHousing: boolean | null; experienceYears: number | null }

/** Văn bản ẩn danh từ tùy chọn nghề nghiệp; không chứa định danh cá nhân. */
export function buildProfileEmbeddingText(profile: ProfileText): string {
  const shiftLabel: Record<string, string> = { day: "ca ngày", night: "ca đêm", rotating: "ca xoay", flexible: "ca linh hoạt" };
  return [
    profile.industry ? `Ngành nghề mong muốn: ${clip(profile.industry, 80)}` : "",
    profile.provinceName ? `Khu vực làm việc: ${clip(profile.provinceName, 60)}` : "",
    profile.kcnName ? `Khu công nghiệp: ${clip(profile.kcnName, 80)}` : "",
    profile.shift ? `Ca làm: ${shiftLabel[profile.shift] || ""}` : "",
    profile.needsHousing === true ? "Cần hỗ trợ nhà ở" : "",
    profile.experienceYears != null ? `Kinh nghiệm ${profile.experienceYears} năm` : "",
  ].filter(Boolean).join("\n");
}

/** Gọi Gemini batchEmbedContents. Trả null nếu chưa cấu hình, lỗi mạng, hết thời gian hoặc phản hồi sai cấu trúc. */
export async function embedTexts(texts: string[], config: EmbeddingConfig, fetchImpl: typeof fetch = fetch): Promise<number[][] | null> {
  if (!config.enabled || texts.length === 0 || texts.length > 100) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:batchEmbedContents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
      body: JSON.stringify({ requests: texts.map(text => ({ model: `models/${config.model}`, content: { parts: [{ text }] }, ...(config.dimensions > 0 ? { outputDimensionality: config.dimensions } : {}) })) }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json() as { embeddings?: Array<{ values?: unknown }> };
    const vectors = data.embeddings?.map(item => item.values);
    if (!vectors || vectors.length !== texts.length) return null;
    const checked: number[][] = [];
    for (const vector of vectors) {
      if (!Array.isArray(vector) || vector.length === 0 || !vector.every(value => typeof value === "number" && Number.isFinite(value))) return null;
      checked.push(vector as number[]);
    }
    return checked;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
