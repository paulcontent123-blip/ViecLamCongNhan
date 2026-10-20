/**
 * Sanitizer HTML tự viết (không thêm dependency) cho nội dung bài viết soạn bằng
 * RichTextEditor ở trang Quản trị. Chạy phía server ngay trước khi ghi DB, nên dữ
 * liệu trong bảng articles luôn sạch ‑ trang công khai render bằng
 * dangerouslySetInnerHTML mà không phải lọc lại.
 *
 * Nguyên tắc: allowlist (chỉ giữ thẻ/thuộc tính/CSS nằm trong danh sách cho phép),
 * mọi thứ còn lại bị bỏ. Không dùng regex "tìm và xoá <script>" vì kiểu đó dễ né.
 */

const VOID_TAGS = new Set(["br", "hr", "img"]);

/** Thẻ được giữ lại ‑ khớp đúng những gì thanh công cụ của editor tạo ra. */
const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "div", "span",
  "strong", "b", "em", "i", "u", "s", "sup", "sub",
  "h1", "h2", "h3", "h4",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
]);

/** Thẻ bị xoá kèm toàn bộ nội dung bên trong (không chỉ xoá cặp thẻ). */
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math"]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  td: new Set(["colspan", "rowspan"]),
  col: new Set(["span"]),
  colgroup: new Set(["span"]),
};

/** Thuộc tính style inline được phép ‑ đủ cho canh lề, bảng và cỡ ảnh. */
const ALLOWED_CSS_PROPS = new Set([
  "text-align", "font-weight", "font-style", "text-decoration",
  "width", "height", "max-width",
  "border", "border-color", "border-width", "border-style", "border-collapse",
  "background-color", "color", "padding", "margin", "vertical-align",
]);

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

function escapeText(value: string): string {
  // Không escape "&" để giữ nguyên entity sẵn có (&nbsp;, &amp;…). Escape "<" và ">"
  // là đủ để phần text không bao giờ trở thành thẻ.
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sanitizeStyle(value: string): string | null {
  const kept: string[] = [];
  for (const decl of value.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (!ALLOWED_CSS_PROPS.has(prop)) continue;
    // url(), expression(), \ escape ‑ chặn hết, các giá trị hợp lệ ở đây không cần.
    if (/url\s*\(|expression|javascript:|@import|[\\]/i.test(val)) continue;
    if (!val) continue;
    kept.push(`${prop}: ${val}`);
  }
  return kept.length > 0 ? kept.join("; ") : null;
}

function sanitizeAttributes(tag: string, raw: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  const out: string[] = [];
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;

  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(raw)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";

    if (name === "style") {
      const style = sanitizeStyle(value);
      if (style) out.push(`style="${escapeAttr(style)}"`);
      continue;
    }
    if (!allowed?.has(name)) continue;

    if (name === "href" || name === "src") {
      const url = value.trim();
      const isSafe = SAFE_URL.test(url) || (name === "src" && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(url));
      if (!isSafe) continue;
      out.push(`${name}="${escapeAttr(url)}"`);
      continue;
    }
    if (name === "target") {
      out.push('target="_blank"');
      continue;
    }
    if (name === "width" || name === "height" || name === "colspan" || name === "rowspan" || name === "span") {
      if (!/^\d{1,4}$/.test(value.trim())) continue;
      out.push(`${name}="${value.trim()}"`);
      continue;
    }
    out.push(`${name}="${escapeAttr(value)}"`);
  }

  // Link mở tab mới luôn kèm rel chống tabnabbing, kể cả khi editor quên gắn.
  if (tag === "a" && out.some((a) => a.startsWith("target="))) {
    const relIndex = out.findIndex((a) => a.startsWith("rel="));
    if (relIndex >= 0) out.splice(relIndex, 1);
    out.push('rel="noopener noreferrer"');
  }

  return out.length > 0 ? ` ${out.join(" ")}` : "";
}

export function sanitizeArticleHtml(input: string): string {
  if (!input) return "";

  // Bỏ comment, doctype, CDATA trước khi duyệt thẻ.
  let html = input.replace(/<!--[\s\S]*?-->/g, "").replace(/<![\s\S]*?>/g, "");

  // Xoá cả nội dung của các thẻ nguy hiểm (kể cả khi không có thẻ đóng).
  for (const tag of DROP_WITH_CONTENT) {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?(?:</${tag}\\s*>|$)`, "gi"), "");
  }

  const tagRe = /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/)?>/g;
  const stack: string[] = [];
  const out: string[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(html)) !== null) {
    if (match.index > cursor) out.push(escapeText(html.slice(cursor, match.index)));
    cursor = tagRe.lastIndex;

    const isClosing = Boolean(match[1]);
    const tag = match[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;

    if (isClosing) {
      // Thẻ đóng lạc lõng (không có thẻ mở tương ứng) bị bỏ để layout trang không vỡ.
      const openIndex = stack.lastIndexOf(tag);
      if (openIndex < 0) continue;
      while (stack.length > openIndex) out.push(`</${stack.pop()}>`);
      continue;
    }

    const attrs = sanitizeAttributes(tag, match[3] ?? "");
    if (VOID_TAGS.has(tag)) {
      out.push(`<${tag}${attrs} />`);
      continue;
    }
    out.push(`<${tag}${attrs}>`);
    stack.push(tag);
  }

  if (cursor < html.length) out.push(escapeText(html.slice(cursor)));
  while (stack.length > 0) out.push(`</${stack.pop()}>`);

  return out.join("").trim();
}

/** Rút text thuần từ HTML ‑ dùng để đếm ký tự/chữ khi validate và tính thời gian đọc. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
