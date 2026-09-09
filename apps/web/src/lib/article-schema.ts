import { z } from "zod";
import { isArticleCategory } from "@/lib/article-categories";

/** Schema dùng chung cho POST /api/admin/articles và PATCH /api/admin/articles/[id].
 * Độ dài nội dung được kiểm tra lại trong lib/admin.ts (đếm trên text thuần, vì bài
 * HTML có nhiều ký tự là thẻ chứ không phải chữ). */
export const articleBodySchema = z.object({
  title: z.string().trim().min(5, "Tiêu đề tối thiểu 5 ký tự."),
  excerpt: z.string().trim().max(500, "Mô tả ngắn tối đa 500 ký tự.").optional().or(z.literal("")),
  content: z.string().min(1, "Nội dung không được để trống."),
  contentFormat: z.enum(["text", "html"]).default("html"),
  seoDescription: z.string().trim().max(320, "Mô tả SEO tối đa 320 ký tự.").optional().or(z.literal("")),
  coverImageUrl: z.string().trim().url("Ảnh đại diện không hợp lệ.").optional().or(z.literal("")),
  authorName: z.string().trim().max(120, "Tên tác giả tối đa 120 ký tự.").optional().or(z.literal("")),
  showToc: z.coerce.boolean().default(false),
  category: z.string().refine(isArticleCategory, "Danh mục không hợp lệ."),
  readMinutes: z.coerce.number().int().min(1).max(60),
  status: z.enum(["draft", "published"]),
});
