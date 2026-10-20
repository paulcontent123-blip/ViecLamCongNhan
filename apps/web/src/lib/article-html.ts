import { htmlToPlainText } from "@/lib/sanitize-html";
import { slugify } from "@/lib/slug";

export interface ArticleHeading {
  id: string;
  level: 2 | 3;
  text: string;
  /** Số thứ tự chỉ tăng ở H2; H3 dùng dấu chấm trong mục lục. */
  number: number | null;
}

/**
 * Gắn id vào các thẻ h2/h3 trong nội dung HTML và trả về danh sách heading để dựng
 * mục lục (table of contents) đầu bài viết. Chạy lúc render trang công khai, không
 * lưu id vào DB ‑ đổi tiêu đề trong bài là mục lục tự khớp lại.
 */
export function buildArticleToc(html: string): { html: string; headings: ArticleHeading[] } {
  const headings: ArticleHeading[] = [];
  const used = new Map<string, number>();
  let h2Number = 0;

  const withIds = html.replace(
    /<h([23])((?:"[^"]*"|'[^']*'|[^>])*)>([\s\S]*?)<\/h\1>/gi,
    (full, levelRaw: string, attrs: string, inner: string) => {
      const text = htmlToPlainText(inner).replace(/\s+/g, " ").trim();
      if (!text) return full;

      const base = slugify(text) || `muc-${headings.length + 1}`;
      const seen = used.get(base) ?? 0;
      used.set(base, seen + 1);
      const id = seen === 0 ? base : `${base}-${seen + 1}`;

      const level = Number(levelRaw) === 3 ? 3 : 2;
      if (level === 2) h2Number += 1;
      headings.push({ id, level, number: level === 2 ? h2Number : null, text });
      const cleanedAttrs = attrs.replace(/\sid\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
      return `<h${levelRaw} id="${id}"${cleanedAttrs}>${inner}</h${levelRaw}>`;
    },
  );

  // Bảng rộng được bọc trong khung cuộn ngang riêng để không phá layout trang trên mobile.
  // Editor không tạo bảng lồng nhau nên thay chuỗi trực tiếp là đủ.
  const withScrollableTables = withIds
    .replace(/<table(\s|>)/gi, '<div class="article-rich-scroll"><table$1')
    .replace(/<\/table>/gi, "</table></div>");

  return { html: withScrollableTables, headings };
}

/** ~200 từ/phút ‑ con số quen dùng cho bài đọc tiếng Việt trên web. */
export function estimateReadMinutes(content: string): number {
  const words = htmlToPlainText(content).split(/\s+/).filter(Boolean).length;
  return Math.min(60, Math.max(1, Math.round(words / 200) || 1));
}
