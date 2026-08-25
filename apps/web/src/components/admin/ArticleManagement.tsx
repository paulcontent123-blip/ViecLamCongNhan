"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminArticleRow } from "@/lib/admin";
import { ARTICLE_CATEGORIES, type ArticleCategory } from "@/lib/article-categories";
import { StatusPill } from "@/components/admin/StatusPill";

interface ArticleFormState {
  title: string;
  excerpt: string;
  content: string;
  category: ArticleCategory;
  readMinutes: string;
  status: "draft" | "published";
}

const EMPTY_FORM: ArticleFormState = {
  title: "",
  excerpt: "",
  content: "",
  category: "luong_thuong",
  readMinutes: "5",
  status: "draft",
};

function toForm(article: AdminArticleRow): ArticleFormState {
  return {
    title: article.title,
    excerpt: article.excerpt ?? "",
    content: article.content,
    category: (article.category in ARTICLE_CATEGORIES ? article.category : "luong_thuong") as ArticleCategory,
    readMinutes: String(article.read_minutes),
    status: article.status,
  };
}

export function ArticleManagement({ articles }: { articles: AdminArticleRow[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminArticleRow | null>(null);
  const [form, setForm] = useState<ArticleFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEditing = editing !== null;

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          category: form.category,
          readMinutes: form.readMinutes,
          status: form.status,
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
                const catMeta = article.category in ARTICLE_CATEGORIES ? ARTICLE_CATEGORIES[article.category as ArticleCategory] : null;
                return (
                  <tr key={article.id} className="border-t border-black/5 align-top">
                    <td className="px-4 py-3">
                      <div className="font-bold text-brand-navy">{article.title}</div>
                      <div className="mt-0.5 text-[11px] text-brand-navy/40">
                        {new Date(article.created_at).toLocaleDateString("vi-VN")}
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
                          {togglingId === article.id
                            ? "…"
                            : article.status === "published"
                              ? "Ẩn"
                              : "Đăng"}
                        </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/45 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSubmit} className="max-h-[90vh] w-full max-w-[90vw] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[16px] font-extrabold text-brand-navy">{isEditing ? "Sửa bài viết" : "Viết bài mới"}</h2>
                <p className="mt-1 text-[12px] text-brand-navy/45">Slug đường dẫn tự tạo từ tiêu đề, không đổi sau khi lưu.</p>
              </div>
              <button type="button" onClick={closeForm} disabled={saving} className="text-xl leading-none text-brand-navy/35 hover:text-brand-navy">
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <label className="block text-[12px] font-semibold text-brand-navy/60">
                Tiêu đề *
                <input
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  required
                  minLength={5}
                  className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                />
              </label>
              <label className="block text-[12px] font-semibold text-brand-navy/60">
                Mô tả ngắn (excerpt)
                <input
                  value={form.excerpt}
                  onChange={(e) => updateField("excerpt", e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
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
                  Thời gian đọc (phút)
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
                  Trạng thái
                  <select
                    value={form.status}
                    onChange={(e) => updateField("status", e.target.value as "draft" | "published")}
                    className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                  >
                    <option value="draft">Bản nháp</option>
                    <option value="published">Đăng công khai</option>
                  </select>
                </label>
              </div>
              <label className="block text-[12px] font-semibold text-brand-navy/60">
                Nội dung *
                <textarea
                  value={form.content}
                  onChange={(e) => updateField("content", e.target.value)}
                  required
                  minLength={20}
                  rows={20}
                  className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2.5 text-[13px] text-brand-navy outline-none focus:border-brand-orange"
                />
              </label>
            </div>

            {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeForm} disabled={saving} className="rounded-lg border border-black/10 px-3.5 py-2.5 text-[12.5px] font-bold text-brand-navy/60 disabled:opacity-50">
                Hủy
              </button>
              <button type="submit" disabled={saving} className="rounded-lg bg-brand-orange px-3.5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-105 disabled:opacity-60">
                {saving ? "Đang lưu…" : isEditing ? "Lưu thay đổi" : "Tạo bài viết"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
