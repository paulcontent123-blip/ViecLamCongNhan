import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin-auth";
import { createArticle } from "@/lib/admin";
import { isArticleCategory } from "@/lib/article-categories";

const bodySchema = z.object({
  title: z.string().trim().min(5, "Tiêu đề tối thiểu 5 ký tự."),
  excerpt: z.string().trim().optional().or(z.literal("")),
  content: z.string().trim().min(20, "Nội dung tối thiểu 20 ký tự."),
  category: z.string().refine(isArticleCategory, "Danh mục không hợp lệ."),
  readMinutes: z.coerce.number().int().min(1).max(60),
  status: z.enum(["draft", "published"]),
});

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const result = await createArticle(parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, article: result.article }, { status: 201 });
}
