import type { ArticleHeading } from "@/lib/article-html";

interface ArticleTocProps {
  headings: ArticleHeading[];
  /** Bản xem trước trong form Admin không gắn liên kết vì editor chưa có id heading. */
  preview?: boolean;
  title?: string;
}

export function ArticleToc({ headings, preview = false, title = "📑 Nội dung bài viết" }: ArticleTocProps) {
  const Wrapper = preview ? "div" : "nav";

  return (
    <Wrapper
      aria-label={preview ? undefined : "Mục lục bài viết"}
      className="rounded-xl border border-black/5 bg-black/[0.02] p-4"
    >
      <div className="mb-2 flex items-center gap-2 text-[12.5px] font-extrabold text-brand-navy">
        <span>{title}</span>
        {preview && (
          <span className="rounded-full bg-brand-orange-light px-2 py-0.5 text-[10px] font-bold text-brand-orange">
            cập nhật trực tiếp
          </span>
        )}
      </div>

      {headings.length > 0 ? (
        <div className="grid gap-1.5" role="list">
          {headings.map((heading) => {
            const marker = heading.level === 2 ? `${heading.number ?? ""}.` : "•";
            const linkClassName = "text-[13px] leading-snug text-brand-navy/70 transition hover:text-brand-orange";

            return (
              <div
                key={heading.id}
                role="listitem"
                className={`flex gap-2 ${heading.level === 3 ? "pl-4" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className={`w-5 shrink-0 text-right text-[13px] font-bold leading-snug ${
                    heading.level === 3 ? "text-brand-navy/40" : "text-brand-navy"
                  }`}
                >
                  {marker}
                </span>
                {preview ? (
                  <span className={linkClassName}>{heading.text}</span>
                ) : (
                  <a href={`#${heading.id}`} className={linkClassName}>
                    {heading.text}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[12px] font-normal leading-relaxed text-brand-navy/45">
          Chưa có tiêu đề H2/H3. Chọn phần nội dung rồi bấm H2 hoặc H3 để thêm vào mục lục.
        </p>
      )}
    </Wrapper>
  );
}
