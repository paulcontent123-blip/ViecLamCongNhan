// Kiểm tra nội dung để chống spam cho các biểu mẫu công khai (câu hỏi Hỏi đáp). Hàm thuần, không phụ thuộc thư viện.
// Đây là lớp lọc nhanh, rẻ; giới hạn tần suất và kiểm tra trùng nằm ở route (xem lib/rate-limit.ts).

export type SpamReason = "too_many_links" | "repeated_characters" | "mostly_symbols" | "repeated_words" | "low_variety" | "blocked_keyword" | "too_long";

export interface SpamVerdict { ok: boolean; reason?: SpamReason; message?: string }

export const MAX_QUESTION_LENGTH = 2000;

/** Chữ thường, không dấu, gộp khoảng trắng; dùng để so khớp trùng lặp và từ khóa. */
export function normalizeQuestionText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Từ khóa thường gặp trong tin rác (đã chuẩn hóa không dấu). Danh sách ngắn, chủ ý; mở rộng theo dữ liệu thực tế.
const BLOCKED_PHRASES = ["casino", "ca cuoc", "nha cai", "xoc dia", "vay tien nhanh", "vay tin chap", "viagra", "ban the sim", "lam dep nhanh", "kiem tien online"];

export function countUrls(text: string): number {
  return (text.match(/(?:https?:\/\/|www\.)\S+/gi) || []).length;
}

export function analyzeQuestion(text: string): SpamVerdict {
  const raw = text.trim();
  if (raw.length > MAX_QUESTION_LENGTH) return { ok: false, reason: "too_long", message: `Câu hỏi tối đa ${MAX_QUESTION_LENGTH} ký tự.` };
  if (countUrls(raw) > 1) return { ok: false, reason: "too_many_links", message: "Câu hỏi chứa quá nhiều liên kết. Vui lòng bỏ bớt liên kết." };
  if (/(.)\1{9,}/u.test(raw)) return { ok: false, reason: "repeated_characters", message: "Câu hỏi có nhiều ký tự lặp liên tiếp. Vui lòng nhập lại nội dung rõ ràng." };

  const letters = (raw.match(/\p{L}/gu) || []).length;
  if (raw.length >= 10 && letters / raw.length < 0.4) return { ok: false, reason: "mostly_symbols", message: "Câu hỏi cần có nội dung chữ rõ ràng." };

  const normalized = normalizeQuestionText(raw);
  const words = normalized.split(" ").filter(Boolean);
  if (words.length >= 6) {
    const counts = new Map<string, number>();
    for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
    if (Math.max(...counts.values()) / words.length > 0.6) return { ok: false, reason: "repeated_words", message: "Câu hỏi lặp lại cùng một từ. Vui lòng nhập nội dung rõ ràng." };
  }
  if (raw.length >= 10 && new Set(raw.toLowerCase().replace(/\s/g, "")).size <= 4) return { ok: false, reason: "low_variety", message: "Câu hỏi chưa có nội dung hợp lệ." };

  const padded = ` ${normalized} `;
  if (BLOCKED_PHRASES.some(phrase => padded.includes(` ${phrase} `))) return { ok: false, reason: "blocked_keyword", message: "Nội dung câu hỏi không phù hợp để gửi." };
  return { ok: true };
}

/** Nhận SĐT Việt Nam (9–11 số, có thể có +84) hoặc email hợp lệ; trả về loại liên hệ hoặc null. */
export function contactKind(contact: string): "phone" | "email" | null {
  const value = contact.trim();
  if (/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254) return "email";
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("84") && digits.length >= 11 ? `0${digits.slice(2)}` : digits;
  return /^0\d{8,10}$/.test(local) && !/^(\d)\1+$/.test(local) ? "phone" : null;
}

/** Khóa gom theo người liên hệ: SĐT về dạng 0xxxxxxxxx, email chữ thường. */
export function contactKey(contact: string): string {
  const value = contact.trim().toLowerCase();
  if (value.includes("@")) return value;
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("84") && digits.length >= 11 ? `0${digits.slice(2)}` : digits;
}
