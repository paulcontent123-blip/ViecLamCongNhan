"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AdminArticleRow } from "@/lib/admin";
import { ARTICLE_CATEGORIES, type ArticleCategory } from "@/lib/article-categories";
import { buildArticleToc, estimateReadMinutes } from "@/lib/article-html";
import { htmlToPlainText } from "@/lib/sanitize-html";
import { slugify } from "@/lib/slug";
import { StatusPill } from "@/components/admin/StatusPill";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { ArticleToc } from "@/components/tintuc/ArticleToc";

interface ArticleFormState {
  title: string;
  excerpt: string;
  content: string;
  seoDescription: string;
  coverImageUrl: string;
  authorName: string;
  showToc: boolean;
  category: ArticleCategory;
  readMinutes: string;
}

const EMPTY_FORM: ArticleFormState = {
  title: "",
  excerpt: "",
  content: "",
  seoDescription: "",
  coverImageUrl: "",
  authorName: "",
  showToc: true,
  category: "luong_thuong",
  readMinutes: "5",
};

/** Bài cũ lưu dạng text thuần: đổi mỗi đoạn thành <p> để mở được bằng trình soạn thảo. */
function plainTextToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function toForm(article: AdminArticleRow): ArticleFormState {
  return {
    title: article.title,
    excerpt: article.excerpt ?? "",
    content: article.content_format === "html" ? article.content : plainTextToHtml(article.content),
    seoDescription: article.seo_description ?? "",
    coverImageUrl: article.cover_image_url ?? "",
    authorName: article.author_name ?? "",
    showToc: article.show_toc,
    category: (article.category in ARTICLE_CATEGORIES ? article.category : "luong_thuong") as ArticleCategory,
    readMinutes: String(article.read_minutes),
  };
}

async function uploadImage(file: File, folder: "article-content" | "article-covers"): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append("folder", folder);
  const response = await fetch("/api/admin/upload-image", { method: "POST", body });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.url) throw new Error(data?.error ?? "Tải ảnh lên thất bại.");
  return data.url as string;
}

export function ArticleManagement({ articles }: { articles: AdminArticleRow[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminArticleRow | null>(null);
  const [form, setForm] = useState<ArticleFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEditing = editing !== null;

  const toc = useMemo(() => buildArticleToc(form.content), [form.content]);

  const contentStats = useMemo(() => {
    const plain = htmlToPlainText(form.content);
    const words = plain.split(/\s+/).filter(Boolean).length;
    const headings = toc.headings.length;
    return { chars: plain.length, words, headings, suggestedMinutes: estimateReadMinutes(form.content) };
  }, [form.content, toc.headings.length]);

  const slugPreview = useMemo(() => (isEditing ? editing.slug : slugify(form.title)), [form.title, isEditing, editing]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(article: AdminArticleRow) {
    setEditing(article);
    setForm(toForm(article));
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function updateField<K extends keyof ArticleFormState>(field: K, value: ArticleFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCoverFile(file: File) {
    setError(null);
    setCoverUploading(true);
    try {
      const url = await uploadImage(file, "article-covers");
      updateField("coverImageUrl", url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải ảnh đại diện thất bại.");
    } finally {
      setCoverUploading(false);
    }
  }

  /** status truyền vào từ nút bấm ("Lưu nháp" / "Đăng ngay") thay vì đọc từ form. */
  async function submit(status: "draft" | "published") {
    if (form.title.trim().length < 5) {
      setError("Tiêu đề tối thiểu 5 ký tự.");
      return;
    }
    if (contentStats.chars < 20) {
      setError("Nội dung tối thiểu 20 ký tự.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(isEditing ? `/api/admin/articles/${editing.id}` : "/api/admin/articles", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          excerpt: form.excerpt,
          content: form.content,
          contentFormat: "html",
          seoDescription: form.seoDescription,
          coverImageUrl: form.coverImageUrl,
          authorName: form.authorName,
          showToc: form.showToc,
          category: form.category,
          readMinutes: form.readMinutes,
          status,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "Không lưu được bài viết.");
        return;
      }
      closeForm();
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(article: AdminArticleRow) {
    const nextStatus = article.status === "published" ? "draft" : "published";
    setTogglingId(article.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/articles/${article.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Không đổi được trạng thái bài viết.");
        return;
      }
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(article: AdminArticleRow) {
    if (!window.confirm(`Xoá bài viết "${article.title}"? Không thể hoàn tác.`)) return;
    setDeletingId(article.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/articles/${article.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Không xoá được bài viết.");
        return;
      }
      router.refresh();
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setDeletingId(null);
    }
  }

  const seoLength = form.seoDescription.trim().length;
  const seoTone = seoLength === 0 ? "text-brand-navy/40" : seoLength < 120 || seoLength > 160 ? "text-amber-600" : "text-emerald-600";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[16px] font-extrabold text-brand-navy">📰 Tin tức / Bài viết</h1>
          <p className="mt-1 text-[13px] text-brand-navy/50">
            Bài viết hiển thị trên trang Tin tức &amp; Quyền lợi ({articles.length.toLocaleString("vi-VN")}).
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-brand-orange px-3.5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-105"
        >
          + Viết bài mới
        </button>
      </div>

      {error && !formOpen && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>
      )}

      {articles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center text-[13.5px] text-brand-navy/45">
          Chưa có bài viết nào.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-black/5 text-[11px] uppercase tracking-wide text-brand-navy/40">
                <th className="px-4 py-3 font-semibold">Bài viết</th>
                <th className="px-4 py-3 font-semibold">Danh mục</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold">Lượt xem</th>
                <th className="px-4 py-3 font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => {
                const catMeta =
                  article.category in ARTICLE_CATEGORIES ? ARTICLE_CATEGORIES[article.category as ArticleCategory] : null;
                return (
                  <tr key={article.id} className="border-t border-black/5 align-top">
                    <td className="px-4 py-3">
                      <div className="flex gap-2.5">
                        {article.cover_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={article.cover_image_url}
                            alt=""
                            className="h-11 w-16 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-16 shrink-0 items-center justify-center rounded-md bg-black/5 text-[15px]">
                            {catMeta?.icon ?? "📰"}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-brand-navy">{article.title}</div>
                          <div className="mt-0.5 text-[11px] text-brand-navy/40">
                            /{article.slug} · {new Date(article.created_at).toLocaleDateString("vi-VN")}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brand-navy/60">
                      {catMeta ? `${catMeta.icon} ${catMeta.label}` : article.category}
                    </td>
                    <td className="px-4 py-3">
                      {article.status === "published" ? (
                        <StatusPill label="Đã đăng" tone="green" />
                      ) : (
                        <StatusPill label="Bản nháp" tone="gray" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-brand-navy/60">{article.view_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(article)}
                          className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/65 transition hover:border-brand-orange hover:text-brand-orange"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(article)}
                          disabled={togglingId === article.id}
                          className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            article.status === "published"
                              ? "border border-black/10 text-brand-navy/65 hover:border-amber-300 hover:text-amber-600"
                              : "bg-emerald-600 text-white hover:brightness-105"
                          }`}
                        >
                          {togglingId === article.id ? "…" : article.status === "published" ? "Ẩn" : "Đăng"}
                        </button>
                        <a
                          href={`/tin-tuc-quyen-loi/${article.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/65 transition hover:border-brand-orange hover:text-brand-orange"
                        >
                          Xem
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDelete(article)}
                          disabled={deletingId === article.id}
                          className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[11.5px] font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {deletingId === article.id ? "Đang xoá…" : "Xoá"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-navy/45 p-4" role="dialog" aria-modal="true">
          <div className="my-4 w-full max-w-[1100px] rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[16px] font-extrabold text-brand-navy">
                  {isEditing ? "Sửa bài viết" : "Viết bài mới"}
                </h2>
                <p className="mt-1 text-[12px] text-brand-navy/45">
                  Đường dẫn:{" "}
                  <span className="font-mono text-brand-navy/70">/tin-tuc-quyen-loi/{slugPreview || "…"}</span>
                  {isEditing ? " (không đổi sau khi lưu)" : " — tự tạo từ tiêu đề"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="text-xl leading-none text-brand-navy/35 transition hover:text-brand-navy"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="block text-[12px] font-semibold text-brand-navy/60">
                Tiêu đề *
                <input
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="VD: Cách tính lương làm thêm giờ năm 2026"
                  className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[14px] font-semibold text-brand-navy outline-none focus:border-brand-orange"
                />
              </label>

              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="grid gap-4">
                  <div>
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[12px] font-semibold text-brand-navy/60">
                      <span>Nội dung bài viết *</span>
                      <span className="text-[11px] font-medium text-brand-navy/40">
                        {contentStats.words.toLocaleString("vi-VN")} từ · {contentStats.headings} tiêu đề mục · ~
                        {contentStats.suggestedMinutes} phút đọc
                      </span>
                    </div>
                    <RichTextEditor
                      value={form.content}
                      onChange={(html) => updateField("content", html)}
                      onUploadImage={(file) => uploadImage(file, "article-content")}
                      disabled={saving}
                      placeholder="Nhập nội dung bài viết… Dùng H2 / H3 để chia mục cho bài dễ đọc và tạo mục lục."
                    />
                    <div className="mt-3">
                      <ArticleToc headings={toc.headings} preview title="🔎 Xem trước mục lục" />
                      {!form.showToc && (
                        <p className="mt-1.5 text-[11px] font-normal text-brand-navy/40">
                          Mục lục đang tắt ở phần cài đặt bên phải nên sẽ không hiển thị trên bài đã đăng.
                        </p>
                      )}
                    </div>
                  </div>

                  <label className="block text-[12px] font-semibold text-brand-navy/60">
                    Mô tả ngắn (excerpt)
                    <textarea
                      value={form.excerpt}
                      onChange={(e) => updateField("excerpt", e.target.value)}
                      rows={2}
                      placeholder="1–2 câu tóm tắt, hiển thị ở thẻ bài viết trên trang danh sách."
                      className="mt-1.5 w-full resize-y rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                    />
                  </label>

                  <label className="block text-[12px] font-semibold text-brand-navy/60">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span>Mô tả SEO (meta description)</span>
                      <span className={`text-[11px] font-medium ${seoTone}`}>{seoLength}/160 ký tự</span>
                    </span>
                    <textarea
                      value={form.seoDescription}
                      onChange={(e) => updateField("seoDescription", e.target.value)}
                      rows={2}
                      placeholder="Nên viết 120–160 ký tự, chứa từ khoá chính."
                      className="mt-1.5 w-full resize-y rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                    />
                    <span className="mt-1 block text-[11px] font-normal text-brand-navy/40">
                      Bỏ trống thì Google lấy &quot;Mô tả ngắn&quot; ở trên.
                    </span>
                  </label>
                </div>

                <div className="grid content-start gap-4 rounded-xl border border-black/5 bg-black/[0.015] p-4">
                  <div className="text-[12px] font-semibold text-brand-navy/60">
                    Ảnh đại diện
                    {form.coverImageUrl ? (
                      <div className="mt-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={form.coverImageUrl} alt="Ảnh đại diện" className="h-[150px] w-full rounded-lg object-cover" />
                        <div className="mt-1.5 flex gap-1.5">
                          <label className="cursor-pointer rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[11.5px] font-bold text-brand-navy/65 transition hover:border-brand-orange hover:text-brand-orange">
                            Đổi ảnh
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              disabled={coverUploading || saving}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void handleCoverFile(file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => updateField("coverImageUrl", "")}
                            className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[11.5px] font-bold text-red-600 transition hover:bg-red-50"
                          >
                            Xoá ảnh
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="mt-1.5 flex h-[110px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-black/15 bg-white text-[12px] font-medium text-brand-navy/45 transition hover:border-brand-orange hover:text-brand-orange">
                        {coverUploading ? "⏳ Đang tải ảnh…" : "🖼 Chọn ảnh (tối đa 5MB)"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          disabled={coverUploading || saving}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleCoverFile(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                    <span className="mt-1 block text-[11px] font-normal text-brand-navy/40">
                      Bỏ trống thì trang bài viết dùng ảnh nền theo danh mục như hiện tại.
                    </span>
                  </div>

                  <label className="block text-[12px] font-semibold text-brand-navy/60">
                    Danh mục *
                    <select
                      value={form.category}
                      onChange={(e) => updateField("category", e.target.value as ArticleCategory)}
                      className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                    >
                      {Object.entries(ARTICLE_CATEGORIES).map(([key, meta]) => (
                        <option key={key} value={key}>
                          {meta.icon} {meta.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-[12px] font-semibold text-brand-navy/60">
                    <span className="flex items-center justify-between gap-2">
                      <span>Thời gian đọc (phút)</span>
                      <button
                        type="button"
                        onClick={() => updateField("readMinutes", String(contentStats.suggestedMinutes))}
                        className="text-[11px] font-bold text-brand-orange"
                      >
                        Tự tính ({contentStats.suggestedMinutes})
                      </button>
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={form.readMinutes}
                      onChange={(e) => updateField("readMinutes", e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                    />
                  </label>

                  <label className="block text-[12px] font-semibold text-brand-navy/60">
                    Tác giả
                    <input
                      value={form.authorName}
                      onChange={(e) => updateField("authorName", e.target.value)}
                      placeholder="VD: Ban biên tập ViecLamCongNhan"
                      className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                    />
                  </label>

                  <label className="flex cursor-pointer items-start gap-2.5 text-[12px] font-semibold text-brand-navy/60">
                    <input
                      type="checkbox"
                      checked={form.showToc}
                      onChange={(e) => updateField("showToc", e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-brand-orange"
                    />
                    <span>
                      Hiển thị mục lục đầu bài viết
                      <span className="mt-0.5 block text-[11px] font-normal text-brand-navy/40">
                        {contentStats.headings > 0
                          ? `Đang có ${contentStats.headings} tiêu đề mục (H2/H3).`
                          : "Chưa có mục lục — dùng nút H2 / H3 để đặt tiêu đề cho các phần trong bài."}
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void submit("draft")}
                disabled={saving}
                className="rounded-lg bg-brand-navy px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {saving ? "Đang lưu…" : "💾 Lưu nháp"}
              </button>
              <button
                type="button"
                onClick={() => void submit("published")}
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-4 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-105 disabled:opacity-60"
              >
                {saving ? "Đang lưu…" : isEditing && editing.status === "published" ? "🚀 Cập nhật bài đã đăng" : "🚀 Đăng ngay"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg border border-black/10 px-4 py-2.5 text-[12.5px] font-bold text-brand-navy/60 transition hover:border-black/20 disabled:opacity-50"
              >
                Hủy
              </button>
              {isEditing && (
                <span className="ml-auto text-[11.5px] text-brand-navy/40">
                  Cập nhật lần cuối: {new Date(editing.updated_at).toLocaleString("vi-VN")}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
